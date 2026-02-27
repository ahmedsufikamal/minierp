import {
  InventoryOpsJobStatus,
  InventoryOutboxEventStatus,
  Prisma,
  type InventoryCostLayer,
  type InventoryOpsJob,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  repostRequestSchema,
  stockClosingRequestSchema,
  varianceReportRequestSchema,
} from "@/modules/inventory/application/schemas";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";
import { getInventoryOpsQueue } from "@/modules/inventory/infrastructure/ops-queue";
import { withSerializableRetry } from "@/modules/inventory/infrastructure/tx";

type RepostScope = {
  itemId?: string;
  warehouseId?: string;
  locationId?: string | null;
  fromPostingSeq?: bigint;
  toPostingSeq?: bigint;
};

type StockClosingScope = {
  itemId?: string;
  warehouseId?: string;
  locationId?: string | null;
  batchId?: string | null;
};

type ScopeKey = `${string}::${string}::${string}`;

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function scopeKeyFor(itemId: string, warehouseId: string, locationId: string | null): ScopeKey {
  return `${itemId}::${warehouseId}::${locationId ?? "~"}`;
}

function parseScopeKey(key: ScopeKey): { itemId: string; warehouseId: string; locationId: string | null } {
  const [itemId, warehouseId, locationToken] = key.split("::");
  return {
    itemId,
    warehouseId,
    locationId: locationToken === "~" ? null : locationToken,
  };
}

function applyLocationFilter<T extends Record<string, unknown>>(
  where: T,
  locationId: string | null | undefined,
): T {
  if (locationId === undefined) return where;
  return {
    ...where,
    locationId,
  } as T;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function toJsonRepostScope(scope: RepostScope): Record<string, string | null | undefined> {
  return {
    itemId: scope.itemId,
    warehouseId: scope.warehouseId,
    locationId: scope.locationId,
    fromPostingSeq: scope.fromPostingSeq?.toString(),
    toPostingSeq: scope.toPostingSeq?.toString(),
  };
}

function buildRepostLedgerWhere(companyId: string, scope: RepostScope): Prisma.InventoryLedgerEntryWhereInput {
  const where: Prisma.InventoryLedgerEntryWhereInput = {
    companyId,
    ...(scope.itemId ? { itemId: scope.itemId } : {}),
    ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}),
  };

  const withLocation = applyLocationFilter(where, scope.locationId);
  if (scope.fromPostingSeq || scope.toPostingSeq) {
    return {
      ...withLocation,
      postingSeq: {
        ...(scope.fromPostingSeq ? { gte: scope.fromPostingSeq } : {}),
        ...(scope.toPostingSeq ? { lte: scope.toPostingSeq } : {}),
      },
    };
  }

  return withLocation;
}

function buildScopeDeleteWhere(companyId: string, scope: RepostScope): Prisma.InventoryStockBalanceWhereInput {
  return applyLocationFilter(
    {
      companyId,
      ...(scope.itemId ? { itemId: scope.itemId } : {}),
      ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}),
    },
    scope.locationId,
  );
}

function collectScopeKeysFromRows(
  rows: Array<{ itemId: string; warehouseId: string; locationId: string | null }>,
): Set<ScopeKey> {
  const keys = new Set<ScopeKey>();
  for (const row of rows) {
    keys.add(scopeKeyFor(row.itemId, row.warehouseId, row.locationId ?? null));
  }
  return keys;
}

function inventoryJobKey(idempotencyKey: string, payload: unknown): string {
  return `${idempotencyKey}:${stableStringify(payload)}`;
}

async function markOpsJobRunning(jobId: string): Promise<void> {
  await prisma.inventoryOpsJob.update({
    where: { id: jobId },
    data: {
      status: InventoryOpsJobStatus.RUNNING,
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
}

async function markOpsJobCompleted(jobId: string, result: Prisma.InputJsonValue): Promise<void> {
  await prisma.inventoryOpsJob.update({
    where: { id: jobId },
    data: {
      status: InventoryOpsJobStatus.COMPLETED,
      progressPct: 100,
      completedAt: new Date(),
      result,
      error: null,
    },
  });
}

async function markOpsJobFailed(jobId: string, error: unknown): Promise<void> {
  await prisma.inventoryOpsJob.update({
    where: { id: jobId },
    data: {
      status: InventoryOpsJobStatus.FAILED,
      completedAt: new Date(),
      error: error instanceof Error ? error.message : String(error ?? "unknown"),
    },
  });
}

export async function runInventoryOutboxRelay(input?: {
  companyId?: string;
  maxRows?: number;
}): Promise<{ processed: number; failed: number; scanned: number }> {
  const maxRows = Math.max(1, Math.min(input?.maxRows ?? 200, 1000));
  const now = new Date();
  const pending = await prisma.inventoryOutboxEvent.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      status: { in: [InventoryOutboxEventStatus.PENDING, InventoryOutboxEventStatus.FAILED] },
      availableAt: { lte: now },
    },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    take: maxRows,
  });

  let processed = 0;
  let failed = 0;

  for (const event of pending) {
    try {
      await prisma.inventoryOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: InventoryOutboxEventStatus.PROCESSING,
          attempts: { increment: 1 },
        },
      });

      // Relay integration can publish to Kafka/SNS/etc. This baseline marks successful delivery.
      await prisma.inventoryOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: InventoryOutboxEventStatus.PROCESSED,
          processedAt: new Date(),
          lastError: null,
        },
      });
      processed += 1;
    } catch (error) {
      failed += 1;
      await prisma.inventoryOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: event.attempts >= 9 ? InventoryOutboxEventStatus.DEAD_LETTER : InventoryOutboxEventStatus.FAILED,
          lastError: error instanceof Error ? error.message : String(error ?? "unknown"),
          availableAt: new Date(Date.now() + 30_000),
        },
      });
    }
  }

  return {
    processed,
    failed,
    scanned: pending.length,
  };
}

export async function generateInventoryVarianceReport(ctx: InventoryRequestContext, input: unknown) {
  const parsed = varianceReportRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid variance report payload", parsed.error.flatten());
  }

  const filter = parsed.data;
  const baseWhere: Prisma.InventoryStockBalanceWhereInput = applyLocationFilter(
    {
      companyId: ctx.companyId,
      ...(filter.itemId ? { itemId: filter.itemId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
    },
    filter.locationId,
  );

  const [settings, balances, ledgerSums] = await Promise.all([
    prisma.inventoryCompanySetting.findUnique({
      where: { companyId: ctx.companyId },
      select: { costingMethod: true },
    }),
    prisma.inventoryStockBalance.findMany({
      where: baseWhere,
      select: {
        itemId: true,
        warehouseId: true,
        locationId: true,
        onHand: true,
      },
    }),
    prisma.inventoryLedgerEntry.groupBy({
      by: ["itemId", "warehouseId", "locationId"],
      where: applyLocationFilter(
        {
          companyId: ctx.companyId,
          ...(filter.itemId ? { itemId: filter.itemId } : {}),
          ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
        },
        filter.locationId,
      ),
      _sum: { quantityDelta: true },
    }),
  ]);

  const balanceMap = new Map<ScopeKey, number>();
  for (const row of balances) {
    balanceMap.set(scopeKeyFor(row.itemId, row.warehouseId, row.locationId ?? null), row.onHand);
  }

  const ledgerMap = new Map<ScopeKey, number>();
  for (const row of ledgerSums) {
    ledgerMap.set(scopeKeyFor(row.itemId, row.warehouseId, row.locationId ?? null), row._sum.quantityDelta ?? 0);
  }

  const keys = new Set<ScopeKey>([...balanceMap.keys(), ...ledgerMap.keys()]);
  const rows = [...keys].map((key) => {
    const parsedKey = parseScopeKey(key);
    const onHand = balanceMap.get(key) ?? 0;
    const ledgerQty = ledgerMap.get(key) ?? 0;
    return {
      ...parsedKey,
      onHand,
      ledgerQty,
      qtyDelta: onHand - ledgerQty,
      layerQty: null as number | null,
      layerDelta: null as number | null,
    };
  });

  if (settings?.costingMethod === "FIFO") {
    const layerSums = await prisma.inventoryCostLayer.groupBy({
      by: ["itemId", "warehouseId", "locationId"],
      where: {
        companyId: ctx.companyId,
        qtyRemaining: { not: 0 },
        ...(filter.itemId ? { itemId: filter.itemId } : {}),
        ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
        ...(filter.locationId !== undefined ? { locationId: filter.locationId } : {}),
      },
      _sum: { qtyRemaining: true },
    });
    const layerMap = new Map<ScopeKey, number>();
    for (const row of layerSums) {
      layerMap.set(scopeKeyFor(row.itemId, row.warehouseId, row.locationId ?? null), row._sum.qtyRemaining ?? 0);
    }

    for (const row of rows) {
      const layerQty = layerMap.get(scopeKeyFor(row.itemId, row.warehouseId, row.locationId)) ?? 0;
      row.layerQty = layerQty;
      row.layerDelta = layerQty - row.onHand;
    }
  }

  const mismatches = rows.filter((row) => {
    const qtyMismatch = row.qtyDelta !== 0;
    const layerMismatch = typeof row.layerDelta === "number" ? row.layerDelta !== 0 : false;
    return filter.includeZeroDelta ? true : qtyMismatch || layerMismatch;
  });

  return {
    generatedAt: new Date().toISOString(),
    fifoEnabled: settings?.costingMethod === "FIFO",
    totalRows: rows.length,
    mismatchCount: mismatches.length,
    rows: mismatches,
  };
}

async function rebuildInventoryDerivedFromLedger(companyId: string, scope: RepostScope): Promise<{
  replayedLedgerEntries: number;
  rebuiltBalances: number;
  rebuiltLayers: number;
}> {
  const ledgerWhere = buildRepostLedgerWhere(companyId, scope);

  const ledgerRows = await prisma.inventoryLedgerEntry.findMany({
    where: ledgerWhere,
    orderBy: [{ postingSeq: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      itemId: true,
      warehouseId: true,
      locationId: true,
      quantityDelta: true,
      unitCostMinor: true,
      totalCostMinor: true,
      currency: true,
      batchCode: true,
      documentId: true,
      documentLineId: true,
    },
  });

  const scopeKeys = collectScopeKeysFromRows(ledgerRows);

  if (scopeKeys.size === 0) {
    return {
      replayedLedgerEntries: 0,
      rebuiltBalances: 0,
      rebuiltLayers: 0,
    };
  }

  const scopeParsed = [...scopeKeys].map((key) => parseScopeKey(key));
  const itemIds = [...new Set(scopeParsed.map((row) => row.itemId))];
  const warehouseIds = [...new Set(scopeParsed.map((row) => row.warehouseId))];
  const batchCodes = [...new Set(ledgerRows.map((row) => row.batchCode).filter((code): code is string => Boolean(code)))];
  const batches = batchCodes.length
    ? await prisma.inventoryBatch.findMany({
        where: {
          companyId,
          batchCode: { in: batchCodes },
          itemId: { in: itemIds },
          warehouseId: { in: warehouseIds },
          ...(scope.locationId !== undefined ? { locationId: scope.locationId } : {}),
        },
        select: {
          id: true,
          itemId: true,
          warehouseId: true,
          locationId: true,
          batchCode: true,
        },
      })
    : [];

  const batchIdByScopeCode = new Map<string, string>();
  for (const batch of batches) {
    batchIdByScopeCode.set(
      `${scopeKeyFor(batch.itemId, batch.warehouseId, batch.locationId ?? null)}::${batch.batchCode}`,
      batch.id,
    );
  }

  type BalanceAccumulator = {
    onHand: number;
    stockValueMinor: number;
    avgCostMinor: number;
    reserved: number;
  };

  type LayerAccumulator = {
    qtyRemaining: number;
    unitCostMinor: number;
    currency: string;
    batchCode: string | null;
    batchId: string | null;
    sourceDocumentId: string | null;
    sourceLineId: string | null;
    sourceLedgerEntryId: string;
  };

  const balanceByScope = new Map<ScopeKey, BalanceAccumulator>();
  const layersByScope = new Map<ScopeKey, LayerAccumulator[]>();

  for (const row of ledgerRows) {
    const key = scopeKeyFor(row.itemId, row.warehouseId, row.locationId ?? null);
    const current = balanceByScope.get(key) ?? {
      onHand: 0,
      stockValueMinor: 0,
      avgCostMinor: row.unitCostMinor ?? 0,
      reserved: 0,
    };
    const layers = layersByScope.get(key) ?? [];

    if (row.quantityDelta > 0) {
      const batchId = row.batchCode
        ? batchIdByScopeCode.get(`${key}::${row.batchCode}`) ?? null
        : null;
      layers.push({
        qtyRemaining: row.quantityDelta,
        unitCostMinor: row.unitCostMinor ?? current.avgCostMinor,
        currency: row.currency,
        batchCode: row.batchCode ?? null,
        batchId,
        sourceDocumentId: row.documentId ?? null,
        sourceLineId: row.documentLineId ?? null,
        sourceLedgerEntryId: row.id,
      });
    } else if (row.quantityDelta < 0) {
      let remaining = Math.abs(row.quantityDelta);
      for (const layer of layers) {
        if (remaining <= 0) break;
        if (row.batchCode && layer.batchCode !== row.batchCode) continue;
        if (layer.qtyRemaining <= 0) continue;
        const used = Math.min(layer.qtyRemaining, remaining);
        layer.qtyRemaining -= used;
        remaining -= used;
      }
    }

    current.onHand += row.quantityDelta;
    current.stockValueMinor += row.totalCostMinor ?? row.quantityDelta * (row.unitCostMinor ?? current.avgCostMinor);
    current.avgCostMinor = current.onHand === 0 ? 0 : Math.round(current.stockValueMinor / current.onHand);

    balanceByScope.set(key, current);
    layersByScope.set(key, layers);
  }

  const deleteWhere = buildScopeDeleteWhere(companyId, scope);
  await withSerializableRetry(async () =>
    prisma.$transaction(
      async (tx) => {
        const oldLayers = await tx.inventoryCostLayer.findMany({
          where: {
            companyId,
            ...(scope.itemId ? { itemId: scope.itemId } : {}),
            ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}),
            ...(scope.locationId !== undefined ? { locationId: scope.locationId } : {}),
          },
          select: { id: true },
        });
        const oldLayerIds = oldLayers.map((row) => row.id);

        if (oldLayerIds.length > 0) {
          await tx.inventoryCostLayerAllocation.deleteMany({
            where: {
              companyId,
              OR: [{ sourceLayerId: { in: oldLayerIds } }, { destinationLayerId: { in: oldLayerIds } }],
            },
          });
        }

        await tx.inventoryCostLayer.deleteMany({
          where: {
            companyId,
            ...(scope.itemId ? { itemId: scope.itemId } : {}),
            ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}),
            ...(scope.locationId !== undefined ? { locationId: scope.locationId } : {}),
          },
        });

        await tx.inventoryStockBalance.deleteMany({
          where: deleteWhere,
        });

        const createdBalances = [...balanceByScope.entries()].map(([key, value]) => {
          const parsed = parseScopeKey(key);
          return {
            companyId,
            itemId: parsed.itemId,
            warehouseId: parsed.warehouseId,
            locationId: parsed.locationId,
            onHand: value.onHand,
            reserved: 0,
            incoming: 0,
            outgoing: 0,
            avgCostMinor: value.avgCostMinor,
            stockValueMinor: value.stockValueMinor,
          };
        });

        if (createdBalances.length > 0) {
          await tx.inventoryStockBalance.createMany({
            data: createdBalances,
          });
        }

        const activeReservations = await tx.inventoryReservation.findMany({
          where: {
            companyId,
            status: "ACTIVE",
            ...(scope.itemId ? { itemId: scope.itemId } : {}),
            ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}),
            ...(scope.locationId !== undefined ? { locationId: scope.locationId } : {}),
          },
          select: {
            itemId: true,
            warehouseId: true,
            locationId: true,
            quantity: true,
            fulfilledQty: true,
          },
        });

        const reservedByScope = new Map<ScopeKey, number>();
        for (const reservation of activeReservations) {
          const scopeKey = scopeKeyFor(reservation.itemId, reservation.warehouseId, reservation.locationId ?? null);
          const reserved = Math.max(reservation.quantity - reservation.fulfilledQty, 0);
          reservedByScope.set(scopeKey, (reservedByScope.get(scopeKey) ?? 0) + reserved);
        }

        for (const [key, reserved] of reservedByScope.entries()) {
          const parsed = parseScopeKey(key);
          await tx.inventoryStockBalance.updateMany({
            where: {
              companyId,
              itemId: parsed.itemId,
              warehouseId: parsed.warehouseId,
              locationId: parsed.locationId,
            },
            data: { reserved },
          });
        }

        const layersToInsert: Prisma.InventoryCostLayerCreateManyInput[] = [];
        for (const [key, layers] of layersByScope.entries()) {
          const parsed = parseScopeKey(key);
          for (const layer of layers) {
            if (layer.qtyRemaining <= 0) continue;
            layersToInsert.push({
              companyId,
              itemId: parsed.itemId,
              warehouseId: parsed.warehouseId,
              locationId: parsed.locationId,
              sourceDocumentId: layer.sourceDocumentId,
              sourceLineId: layer.sourceLineId,
              sourceLedgerEntryId: layer.sourceLedgerEntryId,
              batchId: layer.batchId,
              serialId: null,
              qtyRemaining: layer.qtyRemaining,
              unitCostMinor: layer.unitCostMinor,
              currency: layer.currency,
              metadata: {
                rebuiltFromLedger: true,
              } as unknown as Prisma.InputJsonValue,
            });
          }
        }

        if (layersToInsert.length > 0) {
          await tx.inventoryCostLayer.createMany({
            data: layersToInsert,
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const rebuiltLayers = await prisma.inventoryCostLayer.count({
    where: {
      companyId,
      ...(scope.itemId ? { itemId: scope.itemId } : {}),
      ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}),
      ...(scope.locationId !== undefined ? { locationId: scope.locationId } : {}),
    },
  });

  const rebuiltBalances = await prisma.inventoryStockBalance.count({
    where: buildScopeDeleteWhere(companyId, scope),
  });

  return {
    replayedLedgerEntries: ledgerRows.length,
    rebuiltBalances,
    rebuiltLayers,
  };
}

async function processRepostJob(job: InventoryOpsJob): Promise<Prisma.InputJsonValue> {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const scope = (payload.scope ?? {}) as RepostScope;
  const result = await rebuildInventoryDerivedFromLedger(job.companyId, scope);
  return toJsonValue({
    ...result,
    scope: toJsonRepostScope(scope),
  });
}

async function processStockClosingJob(job: InventoryOpsJob): Promise<Prisma.InputJsonValue> {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const closingId = typeof payload.closingId === "string" ? payload.closingId : null;
  const scope = ((payload.scope ?? {}) as StockClosingScope) ?? {};

  if (!closingId) {
    throw new InventoryError("VALIDATION_ERROR", "Stock closing job is missing closingId");
  }

  const closing = await prisma.inventoryStockClosing.findFirst({
    where: {
      id: closingId,
      companyId: job.companyId,
    },
  });
  if (!closing) {
    throw new InventoryError("NOT_FOUND", "Stock closing record not found");
  }

  await withSerializableRetry(async () =>
    prisma.$transaction(
      async (tx) => {
        await tx.inventoryStockClosing.update({
          where: { id: closing.id },
          data: {
            status: InventoryOpsJobStatus.RUNNING,
            startedAt: new Date(),
          },
        });

        await tx.inventoryStockClosingLine.deleteMany({
          where: { closingId: closing.id, companyId: job.companyId },
        });

        const balances = await tx.inventoryStockBalance.findMany({
          where: {
            companyId: job.companyId,
            ...(scope.itemId ? { itemId: scope.itemId } : {}),
            ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}),
            ...(scope.locationId !== undefined ? { locationId: scope.locationId } : {}),
          },
          select: {
            itemId: true,
            warehouseId: true,
            locationId: true,
            onHand: true,
            stockValueMinor: true,
            avgCostMinor: true,
          },
        });

        if (balances.length > 0) {
          await tx.inventoryStockClosingLine.createMany({
            data: balances.map((row) => ({
              closingId: closing.id,
              companyId: job.companyId,
              itemId: row.itemId,
              warehouseId: row.warehouseId,
              locationId: row.locationId,
              batchId: scope.batchId ?? null,
              qtyOnHand: row.onHand,
              stockValueMinor: row.stockValueMinor,
              avgCostMinor: row.avgCostMinor,
              currency: "BDT",
            })),
          });
        }

        await tx.inventoryStockClosing.update({
          where: { id: closing.id },
          data: {
            status: InventoryOpsJobStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const lineCount = await prisma.inventoryStockClosingLine.count({
    where: { closingId: closing.id, companyId: job.companyId },
  });

  return toJsonValue({
    closingId: closing.id,
    lineCount,
    scope,
  });
}

async function processOutboxRelayJob(job: InventoryOpsJob): Promise<Prisma.InputJsonValue> {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const maxRows = typeof payload.maxRows === "number" ? payload.maxRows : 200;
  const result = await runInventoryOutboxRelay({ companyId: job.companyId, maxRows });
  return toJsonValue(result);
}

export async function processInventoryOpsJobById(jobId: string): Promise<InventoryOpsJob> {
  const job = await prisma.inventoryOpsJob.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new InventoryError("NOT_FOUND", "Inventory ops job not found");
  }

  await markOpsJobRunning(job.id);

  try {
    const result =
      job.jobType === "inventory:repost"
        ? await processRepostJob(job)
        : job.jobType === "inventory:stock-closing"
          ? await processStockClosingJob(job)
          : job.jobType === "inventory:outbox-relay"
            ? await processOutboxRelayJob(job)
            : (() => {
                throw new InventoryError("VALIDATION_ERROR", `Unknown inventory ops job type: ${job.jobType}`);
              })();

    await markOpsJobCompleted(job.id, result);
  } catch (error) {
    await markOpsJobFailed(job.id, error);
    throw error;
  }

  const updated = await prisma.inventoryOpsJob.findUnique({ where: { id: jobId } });
  if (!updated) {
    throw new InventoryError("NOT_FOUND", "Inventory ops job disappeared after processing");
  }
  return updated;
}

async function enqueueOrRunInventoryJob(job: InventoryOpsJob): Promise<InventoryOpsJob> {
  const queue = getInventoryOpsQueue();
  if (queue.provider === "inline") {
    return processInventoryOpsJobById(job.id);
  }

  await queue.enqueue({
    name: job.jobType as "inventory:repost" | "inventory:stock-closing" | "inventory:outbox-relay",
    payload: { jobId: job.id },
    jobId: job.id,
  });

  return job;
}

async function createOrReuseOpsJob(params: {
  companyId: string;
  userId: string;
  jobType: "inventory:repost" | "inventory:stock-closing" | "inventory:outbox-relay";
  jobKey: string;
  payload: Prisma.InputJsonValue;
}): Promise<InventoryOpsJob> {
  const existing = await prisma.inventoryOpsJob.findUnique({
    where: {
      companyId_jobType_jobKey: {
        companyId: params.companyId,
        jobType: params.jobType,
        jobKey: params.jobKey,
      },
    },
  });

  if (existing) {
    if (existing.status === InventoryOpsJobStatus.FAILED || existing.status === InventoryOpsJobStatus.CANCELLED) {
      return prisma.inventoryOpsJob.update({
        where: { id: existing.id },
        data: {
          status: InventoryOpsJobStatus.QUEUED,
          error: null,
          result: Prisma.JsonNull,
          progressPct: 0,
          startedAt: null,
          completedAt: null,
          payload: params.payload,
        },
      });
    }
    return existing;
  }

  return prisma.inventoryOpsJob.create({
    data: {
      companyId: params.companyId,
      jobType: params.jobType,
      jobKey: params.jobKey,
      status: InventoryOpsJobStatus.QUEUED,
      payload: params.payload,
      createdBy: params.userId,
    },
  });
}

export async function enqueueInventoryRepostJob(
  ctx: InventoryRequestContext,
  input: unknown,
  options: { idempotencyKey: string },
) {
  const parsed = repostRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid repost request", parsed.error.flatten());
  }

  const payload = {
    scope: toJsonRepostScope(parsed.data.scope ?? {}),
    reason: parsed.data.reason ?? null,
    idempotencyKey: options.idempotencyKey,
  };
  const job = await createOrReuseOpsJob({
    companyId: ctx.companyId,
    userId: ctx.userId,
    jobType: "inventory:repost",
    jobKey: inventoryJobKey(options.idempotencyKey, payload),
    payload: toJsonValue(payload),
  });

  const enqueued = await enqueueOrRunInventoryJob(job);

  await writeInventoryAudit(ctx, {
    action: "INVENTORY_REPOST_ENQUEUED",
    entityType: "InventoryOpsJob",
    entityId: enqueued.id,
    after: enqueued,
    metadata: {
      idempotencyKey: options.idempotencyKey,
      scope: toJsonRepostScope(parsed.data.scope ?? {}),
    },
  });

  return enqueued;
}

export async function enqueueInventoryStockClosingJob(
  ctx: InventoryRequestContext,
  input: unknown,
  options: { idempotencyKey: string },
) {
  const parsed = stockClosingRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid stock closing request", parsed.error.flatten());
  }

  if (parsed.data.periodEnd < parsed.data.periodStart) {
    throw new InventoryError("VALIDATION_ERROR", "periodEnd must be after or equal to periodStart");
  }

  const closing = await prisma.inventoryStockClosing.create({
    data: {
      companyId: ctx.companyId,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      status: InventoryOpsJobStatus.QUEUED,
      scope: toJsonValue(parsed.data.scope ?? {}),
      createdBy: ctx.userId,
    },
  });

  const payload = {
    closingId: closing.id,
    periodStart: parsed.data.periodStart.toISOString(),
    periodEnd: parsed.data.periodEnd.toISOString(),
    scope: parsed.data.scope ?? {},
    reason: parsed.data.reason ?? null,
    idempotencyKey: options.idempotencyKey,
  };

  const job = await createOrReuseOpsJob({
    companyId: ctx.companyId,
    userId: ctx.userId,
    jobType: "inventory:stock-closing",
    jobKey: inventoryJobKey(options.idempotencyKey, payload),
    payload: toJsonValue(payload),
  });

  const enqueued = await enqueueOrRunInventoryJob(job);

  await writeInventoryAudit(ctx, {
    action: "INVENTORY_STOCK_CLOSING_ENQUEUED",
    entityType: "InventoryOpsJob",
    entityId: enqueued.id,
    after: enqueued,
    metadata: {
      idempotencyKey: options.idempotencyKey,
      closingId: closing.id,
    },
  });

  return {
    job: enqueued,
    closingId: closing.id,
  };
}

export async function listInventoryOpsJobs(
  ctx: InventoryRequestContext,
  input?: { status?: InventoryOpsJobStatus; take?: number },
) {
  return prisma.inventoryOpsJob.findMany({
    where: {
      companyId: ctx.companyId,
      ...(input?.status ? { status: input.status } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(input?.take ?? 100, 500)),
  });
}

export async function enqueueInventoryOutboxRelayJob(
  ctx: InventoryRequestContext,
  options: { idempotencyKey: string; maxRows?: number },
) {
  const payload = {
    maxRows: options.maxRows ?? 200,
    idempotencyKey: options.idempotencyKey,
  };

  const job = await createOrReuseOpsJob({
    companyId: ctx.companyId,
    userId: ctx.userId,
    jobType: "inventory:outbox-relay",
    jobKey: inventoryJobKey(options.idempotencyKey, payload),
    payload: toJsonValue(payload),
  });

  return enqueueOrRunInventoryJob(job);
}

export async function listLatestStockClosing(
  ctx: InventoryRequestContext,
  input?: { take?: number },
) {
  return prisma.inventoryStockClosing.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(input?.take ?? 20, 100)),
  });
}

export async function readStockClosingSnapshot(
  ctx: InventoryRequestContext,
  input: { closingId: string },
): Promise<{
  closingId: string;
  lines: Array<{
    itemId: string;
    warehouseId: string;
    locationId: string | null;
    batchId: string | null;
    qtyOnHand: number;
    stockValueMinor: number;
    avgCostMinor: number | null;
    currency: string;
  }>;
}> {
  const lines = await prisma.inventoryStockClosingLine.findMany({
    where: { companyId: ctx.companyId, closingId: input.closingId },
    select: {
      itemId: true,
      warehouseId: true,
      locationId: true,
      batchId: true,
      qtyOnHand: true,
      stockValueMinor: true,
      avgCostMinor: true,
      currency: true,
    },
  });
  return { closingId: input.closingId, lines };
}

export async function buildLedgerBasedStockSnapshot(
  ctx: InventoryRequestContext,
  input: {
    itemId?: string;
    warehouseId?: string;
    locationId?: string | null;
    batchCode?: string | null;
  },
): Promise<
  Array<{
    itemId: string;
    warehouseId: string;
    locationId: string | null;
    qtyOnHand: number;
    stockValueMinor: number;
  }>
> {
  const ledgerRows = await prisma.inventoryLedgerEntry.groupBy({
    by: ["itemId", "warehouseId", "locationId"],
    where: {
      companyId: ctx.companyId,
      ...(input.itemId ? { itemId: input.itemId } : {}),
      ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
      ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
      ...(input.batchCode !== undefined ? { batchCode: input.batchCode } : {}),
    },
    _sum: {
      quantityDelta: true,
      totalCostMinor: true,
    },
  });

  return ledgerRows.map((row) => ({
    itemId: row.itemId,
    warehouseId: row.warehouseId,
    locationId: row.locationId ?? null,
    qtyOnHand: row._sum.quantityDelta ?? 0,
    stockValueMinor: row._sum.totalCostMinor ?? 0,
  }));
}

export function consumeFifoLayersDetailedForTest(layers: InventoryCostLayer[], quantity: number): {
  allocations: Array<{ layerId: string; qty: number; unitCostMinor: number; currency: string }>;
  totalCostMinor: number;
  remainingQty: number;
} {
  let remaining = Math.max(0, quantity);
  let totalCostMinor = 0;
  const allocations: Array<{ layerId: string; qty: number; unitCostMinor: number; currency: string }> = [];

  for (const layer of layers) {
    if (remaining <= 0) break;
    if (layer.qtyRemaining <= 0) continue;
    const consumed = Math.min(layer.qtyRemaining, remaining);
    allocations.push({
      layerId: layer.id,
      qty: consumed,
      unitCostMinor: layer.unitCostMinor,
      currency: layer.currency,
    });
    totalCostMinor += consumed * layer.unitCostMinor;
    remaining -= consumed;
  }

  return {
    allocations,
    totalCostMinor,
    remainingQty: remaining,
  };
}
