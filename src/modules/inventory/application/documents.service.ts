import {
  InventoryDocumentStatus,
  InventoryDocumentType,
  InventorySerialStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  documentActionSchema,
  documentListQuerySchema,
  documentUpsertSchema,
  ledgerQuerySchema,
} from "@/modules/inventory/application/schemas";
import { hasInventoryPermission } from "@/modules/inventory/application/policy";
import { consumeInventoryReservationInTx } from "@/modules/inventory/application/reservations.service";
import { resolveWorkflowTransition } from "@/modules/inventory/application/workflow.service";
import { InventoryError } from "@/modules/inventory/domain/errors";
import { computeAverageCost, enforceNextOnHand } from "@/modules/inventory/domain/posting";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";

type AppContext = Omit<InventoryRequestContext, "role"> & { role: import("@/modules/inventory/domain/types").InventoryRole };

function pageToSkip(page: number, limit: number) {
  return Math.max(0, (page - 1) * limit);
}

function ensurePositiveInt(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new InventoryError("VALIDATION_ERROR", `${label} must be a positive integer`);
  }
}

function asJsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeSerialNumbers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean))];
}

function lineSerialNumbers(line: {
  serialNumbers?: Prisma.JsonValue | null;
  customData?: Prisma.JsonValue | null;
}): string[] {
  const explicit = normalizeSerialNumbers(line.serialNumbers);
  if (explicit.length > 0) return explicit;
  const custom = asJsonObject(line.customData);
  return normalizeSerialNumbers(custom?.serialNumbers);
}

function lineBatchCode(line: {
  batchCode?: string | null;
  customData?: Prisma.JsonValue | null;
}): string | null {
  const explicit = typeof line.batchCode === "string" ? line.batchCode.trim() : "";
  if (explicit) return explicit;
  const custom = asJsonObject(line.customData);
  const legacy = typeof custom?.batchCode === "string" ? custom.batchCode.trim() : "";
  return legacy || null;
}

function lineReservationId(line: {
  reservationId?: string | null;
  customData?: Prisma.JsonValue | null;
}): string | null {
  const explicit = typeof line.reservationId === "string" ? line.reservationId.trim() : "";
  if (explicit) return explicit;
  const custom = asJsonObject(line.customData);
  const legacy = typeof custom?.reservationId === "string" ? custom.reservationId.trim() : "";
  return legacy || null;
}

async function getInventorySettings(companyId: string) {
  const settings = await prisma.inventoryCompanySetting.findUnique({
    where: { companyId },
  });

  return (
    settings ?? {
      companyId,
      trackByLocation: false,
      preventNegativeStock: true,
      allowNegativeOverride: false,
      costingMethod: "AVG",
      baseCurrency: "BDT",
      id: "default",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }
  );
}

export async function listInventoryDocuments(ctx: AppContext, input: unknown) {
  const parsed = documentListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid document query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.InventoryDocumentWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.type ? { documentType: q.type } : {}),
    ...(q.q
      ? {
          OR: [
            { number: { contains: q.q, mode: "insensitive" } },
            { externalRef: { contains: q.q, mode: "insensitive" } },
            { notes: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.inventoryDocument.findMany({
      where,
      include: {
        sourceWarehouse: true,
        destinationWarehouse: true,
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
          },
          orderBy: { lineNo: "asc" },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.inventoryDocument.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function getInventoryDocument(ctx: AppContext, documentId: string) {
  const doc = await prisma.inventoryDocument.findFirst({
    where: { id: documentId, companyId: ctx.companyId },
    include: {
      sourceWarehouse: true,
      sourceLocation: true,
      destinationWarehouse: true,
      destinationLocation: true,
      lines: {
        include: {
          item: { select: { id: true, sku: true, name: true, uom: true } },
          sourceWarehouse: true,
          sourceLocation: true,
          destinationWarehouse: true,
          destinationLocation: true,
        },
        orderBy: { lineNo: "asc" },
      },
      workflow: true,
      ledgerEntries: {
        orderBy: { postingTime: "desc" },
        take: 100,
      },
    },
  });

  if (!doc) {
    throw new InventoryError("NOT_FOUND", "Document not found");
  }

  return doc;
}

function assertDocumentSourceDestination(payload: {
  documentType: InventoryDocumentType;
  sourceWarehouseId?: string | null;
  destinationWarehouseId?: string | null;
  lines: Array<{
    sourceWarehouseId?: string | null;
    destinationWarehouseId?: string | null;
    quantity: number;
  }>;
}) {
  const sourceOnDoc = payload.sourceWarehouseId;
  const destOnDoc = payload.destinationWarehouseId;

  for (const line of payload.lines) {
    ensurePositiveInt(Math.abs(line.quantity), "line quantity");
  }

  if (payload.documentType === InventoryDocumentType.RECEIPT) {
    const missingDest = payload.lines.some((line) => !(line.destinationWarehouseId || destOnDoc));
    if (missingDest) {
      throw new InventoryError("VALIDATION_ERROR", "RECEIPT requires destination warehouse on doc or each line");
    }
  }

  if (payload.documentType === InventoryDocumentType.ISSUE || payload.documentType === InventoryDocumentType.COUNT) {
    const missingSource = payload.lines.some((line) => !(line.sourceWarehouseId || sourceOnDoc));
    if (missingSource) {
      throw new InventoryError("VALIDATION_ERROR", `${payload.documentType} requires source warehouse on doc or each line`);
    }
  }

  if (payload.documentType === InventoryDocumentType.TRANSFER) {
    const missing = payload.lines.some(
      (line) => !(line.sourceWarehouseId || sourceOnDoc) || !(line.destinationWarehouseId || destOnDoc),
    );
    if (missing) {
      throw new InventoryError(
        "VALIDATION_ERROR",
        "TRANSFER requires source and destination warehouse on doc or each line",
      );
    }
  }
}

export async function createInventoryDocument(ctx: AppContext, input: unknown) {
  const parsed = documentUpsertSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid document payload", parsed.error.flatten());
  }

  assertDocumentSourceDestination(parsed.data);

  const existing = await prisma.inventoryDocument.findUnique({
    where: {
      companyId_number: {
        companyId: ctx.companyId,
        number: parsed.data.number,
      },
    },
    select: { id: true },
  });

  if (existing) {
    throw new InventoryError("CONFLICT", "Document number already exists");
  }

  const created = await prisma.inventoryDocument.create({
    data: {
      companyId: ctx.companyId,
      documentType: parsed.data.documentType,
      number: parsed.data.number,
      documentDate: parsed.data.documentDate,
      externalRef: parsed.data.externalRef,
      notes: parsed.data.notes,
      sourceWarehouseId: parsed.data.sourceWarehouseId,
      sourceLocationId: parsed.data.sourceLocationId,
      destinationWarehouseId: parsed.data.destinationWarehouseId,
      destinationLocationId: parsed.data.destinationLocationId,
      metadata: (parsed.data.metadata ?? null) as Prisma.InputJsonValue,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
      workflow: {
        create: {
          companyId: ctx.companyId,
          currentStatus: InventoryDocumentStatus.DRAFT,
          steps: {
            history: [
              {
                action: "CREATE",
                by: ctx.userId,
                at: new Date().toISOString(),
                status: InventoryDocumentStatus.DRAFT,
              },
            ],
          },
        },
      },
      lines: {
        create: parsed.data.lines.map((line, index) => ({
          companyId: ctx.companyId,
          lineNo: index + 1,
          itemId: line.itemId,
          description: line.description,
          quantity: line.quantity,
          unitCostMinor: line.unitCostMinor,
          currency: line.currency,
          sourceWarehouseId: line.sourceWarehouseId,
          sourceLocationId: line.sourceLocationId,
          destinationWarehouseId: line.destinationWarehouseId,
          destinationLocationId: line.destinationLocationId,
          reservationId: line.reservationId,
          batchCode: line.batchCode,
          serialNumbers: (line.serialNumbers ?? null) as Prisma.InputJsonValue,
          customData: (line.customData ?? null) as Prisma.InputJsonValue,
        })),
      },
    },
    include: {
      lines: true,
      workflow: true,
    },
  });

  await writeInventoryAudit(ctx, {
    action: "DOCUMENT_CREATED",
    entityType: "InventoryDocument",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updateInventoryDocument(ctx: AppContext, documentId: string, input: unknown) {
  const parsed = documentUpsertSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid document payload", parsed.error.flatten());
  }

  const existing = await prisma.inventoryDocument.findFirst({
    where: { id: documentId, companyId: ctx.companyId },
    include: { lines: true },
  });
  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Document not found");
  }

  if (existing.status !== InventoryDocumentStatus.DRAFT) {
    throw new InventoryError("CONFLICT", "Only draft documents can be edited");
  }

  const mergedType = parsed.data.documentType ?? existing.documentType;
  const mergedSourceWarehouse = parsed.data.sourceWarehouseId ?? existing.sourceWarehouseId;
  const mergedDestinationWarehouse = parsed.data.destinationWarehouseId ?? existing.destinationWarehouseId;
  const mergedLines =
    parsed.data.lines ??
    existing.lines.map((line) => ({
      itemId: line.itemId,
      description: line.description,
      quantity: line.quantity,
      unitCostMinor: line.unitCostMinor,
      currency: line.currency,
      sourceWarehouseId: line.sourceWarehouseId,
      sourceLocationId: line.sourceLocationId,
      destinationWarehouseId: line.destinationWarehouseId,
      destinationLocationId: line.destinationLocationId,
      reservationId: lineReservationId(line),
      batchCode: lineBatchCode(line),
      serialNumbers: lineSerialNumbers(line),
      customData: (line.customData ?? {}) as Record<string, unknown>,
    }));

  assertDocumentSourceDestination({
    documentType: mergedType,
    sourceWarehouseId: mergedSourceWarehouse,
    destinationWarehouseId: mergedDestinationWarehouse,
    lines: mergedLines,
  });

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.lines) {
      await tx.inventoryDocumentLine.deleteMany({ where: { documentId } });
    }

    return tx.inventoryDocument.update({
      where: { id: documentId },
      data: {
        documentType: parsed.data.documentType,
        number: parsed.data.number,
        documentDate: parsed.data.documentDate,
        externalRef: parsed.data.externalRef,
        notes: parsed.data.notes,
        sourceWarehouseId: parsed.data.sourceWarehouseId,
        sourceLocationId: parsed.data.sourceLocationId,
        destinationWarehouseId: parsed.data.destinationWarehouseId,
        destinationLocationId: parsed.data.destinationLocationId,
        metadata:
          parsed.data.metadata === undefined ? undefined : (parsed.data.metadata as Prisma.InputJsonValue),
        updatedBy: ctx.userId,
        ...(parsed.data.lines
          ? {
              lines: {
                create: parsed.data.lines.map((line, index) => ({
                  companyId: ctx.companyId,
                  lineNo: index + 1,
                  itemId: line.itemId,
                  description: line.description,
                  quantity: line.quantity,
                  unitCostMinor: line.unitCostMinor,
                  currency: line.currency,
                  sourceWarehouseId: line.sourceWarehouseId,
                  sourceLocationId: line.sourceLocationId,
                  destinationWarehouseId: line.destinationWarehouseId,
                  destinationLocationId: line.destinationLocationId,
                  reservationId: line.reservationId,
                  batchCode: line.batchCode,
                  serialNumbers: (line.serialNumbers ?? null) as Prisma.InputJsonValue,
                  customData: (line.customData ?? null) as Prisma.InputJsonValue,
                })),
              },
            }
          : {}),
      },
      include: { lines: true },
    });
  });

  await writeInventoryAudit(ctx, {
    action: "DOCUMENT_UPDATED",
    entityType: "InventoryDocument",
    entityId: documentId,
    before: existing,
    after: updated,
  });

  return updated;
}

type StockMovement = {
  lineId: string;
  itemId: string;
  warehouseId: string;
  locationId?: string | null;
  delta: number;
  unitCostMinor: number;
  currency: string;
  reservationId?: string | null;
  batchCode?: string | null;
  serialNumbers: string[];
  metadata: Record<string, unknown>;
};

type ItemTrackingProfile = {
  id: string;
  trackSerial: boolean;
  trackBatch: boolean;
};

async function lockBalanceRow(
  tx: Prisma.TransactionClient,
  companyId: string,
  itemId: string,
  warehouseId: string,
  locationId: string | null,
): Promise<void> {
  await tx.$queryRawUnsafe(
    'SELECT 1 FROM "InventoryStockBalance" WHERE "orgId" = $1 AND "itemId" = $2 AND "warehouseId" = $3 AND ("locationId" IS NOT DISTINCT FROM $4) FOR UPDATE',
    companyId,
    itemId,
    warehouseId,
    locationId,
  );
}

async function lockBatchRow(
  tx: Prisma.TransactionClient,
  companyId: string,
  itemId: string,
  warehouseId: string,
  locationId: string | null,
  batchCode: string,
): Promise<void> {
  await tx.$queryRawUnsafe(
    'SELECT 1 FROM "InventoryBatch" WHERE "orgId" = $1 AND "itemId" = $2 AND "warehouseId" = $3 AND ("locationId" IS NOT DISTINCT FROM $4) AND "batchCode" = $5 FOR UPDATE',
    companyId,
    itemId,
    warehouseId,
    locationId,
    batchCode,
  );
}

function assertSerialBatchPayload(params: {
  documentType: InventoryDocumentType;
  line: {
    quantity: number;
    itemId: string;
    serialNumbers: string[];
    batchCode: string | null;
  };
  tracking: ItemTrackingProfile;
}): void {
  const absoluteQty = Math.abs(params.line.quantity);
  const serialCount = params.line.serialNumbers.length;

  if (params.documentType === InventoryDocumentType.COUNT && serialCount > 0) {
    throw new InventoryError(
      "VALIDATION_ERROR",
      `Serial numbers are not supported on COUNT reconciliation lines for item ${params.line.itemId}`,
    );
  }

  if (params.tracking.trackSerial) {
    if (params.documentType === InventoryDocumentType.COUNT) {
      throw new InventoryError(
        "VALIDATION_ERROR",
        `Serial-tracked item ${params.line.itemId} is not supported in COUNT reconciliation baseline`,
      );
    }
    if (serialCount !== absoluteQty) {
      throw new InventoryError(
        "VALIDATION_ERROR",
        `Serial-tracked item ${params.line.itemId} requires ${absoluteQty} serial numbers`,
      );
    }
  } else if (
    serialCount > 0 &&
    params.documentType !== InventoryDocumentType.COUNT &&
    serialCount !== absoluteQty
  ) {
    throw new InventoryError(
      "VALIDATION_ERROR",
      `Provided serial numbers (${serialCount}) do not match quantity (${absoluteQty}) for item ${params.line.itemId}`,
    );
  }

  if (params.tracking.trackBatch && !params.line.batchCode) {
    throw new InventoryError(
      "VALIDATION_ERROR",
      `Batch-tracked item ${params.line.itemId} requires batchCode on each movement line`,
    );
  }
}

async function applyBatchMovementInTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    itemId: string;
    warehouseId: string;
    locationId: string | null;
    batchCode: string | null;
    delta: number;
    metadata: Record<string, unknown>;
    userId: string;
    preventNegativeStock: boolean;
    allowNegativeOverride: boolean;
  },
): Promise<string | null> {
  if (!params.batchCode) return null;

  await lockBatchRow(
    tx,
    params.companyId,
    params.itemId,
    params.warehouseId,
    params.locationId,
    params.batchCode,
  );

  const existing = await tx.inventoryBatch.findFirst({
    where: {
      companyId: params.companyId,
      itemId: params.itemId,
      warehouseId: params.warehouseId,
      locationId: params.locationId,
      batchCode: params.batchCode,
    },
    select: {
      id: true,
      quantityOnHand: true,
      metadata: true,
    },
  });

  const previousQty = existing?.quantityOnHand ?? 0;
  const nextQty = enforceNextOnHand({
    previousOnHand: previousQty,
    delta: params.delta,
    preventNegativeStock: params.preventNegativeStock,
    allowNegativeOverride: params.allowNegativeOverride,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
  });

  if (existing) {
    const mergedMetadata = {
      ...(typeof existing.metadata === "object" && existing.metadata ? (existing.metadata as Record<string, unknown>) : {}),
      ...params.metadata,
    } as Prisma.InputJsonValue;

    const updated = await tx.inventoryBatch.update({
      where: { id: existing.id },
      data: {
        quantityOnHand: nextQty,
        metadata: mergedMetadata,
      },
      select: { id: true },
    });
    return updated.id;
  }

  const created = await tx.inventoryBatch.create({
    data: {
      companyId: params.companyId,
      itemId: params.itemId,
      warehouseId: params.warehouseId,
      locationId: params.locationId,
      batchCode: params.batchCode,
      quantityOnHand: nextQty,
      metadata: params.metadata as Prisma.InputJsonValue,
      createdBy: params.userId,
    },
    select: { id: true },
  });

  return created.id;
}

async function applySerialMovementInTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    itemId: string;
    warehouseId: string;
    locationId: string | null;
    delta: number;
    serialNumbers: string[];
    batchId: string | null;
    movementKind: string;
    userId: string;
    postingTime: Date;
  },
): Promise<void> {
  if (params.serialNumbers.length === 0) return;

  for (const serialNumber of params.serialNumbers) {
    const existing = await tx.inventorySerial.findUnique({
      where: {
        companyId_serialNumber: {
          companyId: params.companyId,
          serialNumber,
        },
      },
    });

    if (existing && existing.itemId !== params.itemId) {
      throw new InventoryError(
        "CONFLICT",
        `Serial '${serialNumber}' already belongs to a different item`,
      );
    }

    if (params.delta < 0) {
      if (!existing) {
        throw new InventoryError(
          "CONFLICT",
          `Serial '${serialNumber}' is not available for outbound movement`,
        );
      }

      if (existing.warehouseId !== params.warehouseId) {
        throw new InventoryError(
          "CONFLICT",
          `Serial '${serialNumber}' is not in source warehouse ${params.warehouseId}`,
        );
      }

      if ((existing.locationId ?? null) !== params.locationId) {
        throw new InventoryError(
          "CONFLICT",
          `Serial '${serialNumber}' is not in source location for this movement`,
        );
      }

      const nextStatus =
        params.movementKind === "TRANSFER_OUT"
          ? InventorySerialStatus.RESERVED
          : InventorySerialStatus.ISSUED;

      await tx.inventorySerial.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          batchId: params.batchId ?? existing.batchId,
          ...(nextStatus === InventorySerialStatus.RESERVED
            ? {
                warehouseId: null,
                locationId: null,
              }
            : {
                warehouseId: null,
                locationId: null,
              }),
          metadata: {
            ...(typeof existing.metadata === "object" && existing.metadata ? (existing.metadata as Record<string, unknown>) : {}),
            lastMovementKind: params.movementKind,
            movedAt: params.postingTime.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
      continue;
    }

    if (existing) {
      await tx.inventorySerial.update({
        where: { id: existing.id },
        data: {
          status: InventorySerialStatus.AVAILABLE,
          warehouseId: params.warehouseId,
          locationId: params.locationId,
          batchId: params.batchId ?? existing.batchId,
          metadata: {
            ...(typeof existing.metadata === "object" && existing.metadata ? (existing.metadata as Record<string, unknown>) : {}),
            lastMovementKind: params.movementKind,
            movedAt: params.postingTime.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
      continue;
    }

    await tx.inventorySerial.create({
      data: {
        companyId: params.companyId,
        itemId: params.itemId,
        serialNumber,
        status: InventorySerialStatus.AVAILABLE,
        batchId: params.batchId,
        warehouseId: params.warehouseId,
        locationId: params.locationId,
        metadata: {
          createdByMovementKind: params.movementKind,
          createdAt: params.postingTime.toISOString(),
        },
        createdBy: params.userId,
      },
    });
  }
}

function buildMovementsForLine(params: {
  type: InventoryDocumentType;
  line: {
    id: string;
    itemId: string;
    quantity: number;
    unitCostMinor: number | null;
    currency: string;
    sourceWarehouseId: string | null;
    sourceLocationId: string | null;
    destinationWarehouseId: string | null;
    destinationLocationId: string | null;
    reservationId: string | null;
    batchCode: string | null;
    serialNumbers: string[];
  };
  docDefaults: {
    sourceWarehouseId: string | null;
    sourceLocationId: string | null;
    destinationWarehouseId: string | null;
    destinationLocationId: string | null;
  };
}): StockMovement[] {
  const qtyAbs = Math.abs(params.line.quantity);
  const unitCostMinor = params.line.unitCostMinor ?? 0;
  const sourceWarehouseId = params.line.sourceWarehouseId ?? params.docDefaults.sourceWarehouseId;
  const sourceLocationId = params.line.sourceLocationId ?? params.docDefaults.sourceLocationId;
  const destinationWarehouseId =
    params.line.destinationWarehouseId ?? params.docDefaults.destinationWarehouseId;
  const destinationLocationId =
    params.line.destinationLocationId ?? params.docDefaults.destinationLocationId;

  switch (params.type) {
    case InventoryDocumentType.RECEIPT: {
      if (!destinationWarehouseId) {
        throw new InventoryError("VALIDATION_ERROR", "RECEIPT line is missing destination warehouse");
      }
      return [
        {
          lineId: params.line.id,
          itemId: params.line.itemId,
          warehouseId: destinationWarehouseId,
          locationId: destinationLocationId,
          delta: qtyAbs,
          unitCostMinor,
          currency: params.line.currency,
          reservationId: params.line.reservationId,
          batchCode: params.line.batchCode,
          serialNumbers: params.line.serialNumbers,
          metadata: { kind: "RECEIPT_IN" },
        },
      ];
    }
    case InventoryDocumentType.ISSUE: {
      if (!sourceWarehouseId) {
        throw new InventoryError("VALIDATION_ERROR", "ISSUE line is missing source warehouse");
      }
      return [
        {
          lineId: params.line.id,
          itemId: params.line.itemId,
          warehouseId: sourceWarehouseId,
          locationId: sourceLocationId,
          delta: -qtyAbs,
          unitCostMinor,
          currency: params.line.currency,
          reservationId: params.line.reservationId,
          batchCode: params.line.batchCode,
          serialNumbers: params.line.serialNumbers,
          metadata: { kind: "ISSUE_OUT" },
        },
      ];
    }
    case InventoryDocumentType.TRANSFER: {
      if (!sourceWarehouseId || !destinationWarehouseId) {
        throw new InventoryError("VALIDATION_ERROR", "TRANSFER line is missing source/destination warehouse");
      }
      return [
        {
          lineId: params.line.id,
          itemId: params.line.itemId,
          warehouseId: sourceWarehouseId,
          locationId: sourceLocationId,
          delta: -qtyAbs,
          unitCostMinor,
          currency: params.line.currency,
          reservationId: params.line.reservationId,
          batchCode: params.line.batchCode,
          serialNumbers: params.line.serialNumbers,
          metadata: { kind: "TRANSFER_OUT" },
        },
        {
          lineId: params.line.id,
          itemId: params.line.itemId,
          warehouseId: destinationWarehouseId,
          locationId: destinationLocationId,
          delta: qtyAbs,
          unitCostMinor,
          currency: params.line.currency,
          reservationId: params.line.reservationId,
          batchCode: params.line.batchCode,
          serialNumbers: params.line.serialNumbers,
          metadata: { kind: "TRANSFER_IN" },
        },
      ];
    }
    case InventoryDocumentType.ADJUSTMENT: {
      const warehouseId = sourceWarehouseId ?? destinationWarehouseId;
      const locationId = sourceLocationId ?? destinationLocationId;
      if (!warehouseId) {
        throw new InventoryError("VALIDATION_ERROR", "ADJUSTMENT line is missing warehouse");
      }
      return [
        {
          lineId: params.line.id,
          itemId: params.line.itemId,
          warehouseId,
          locationId,
          delta: params.line.quantity,
          unitCostMinor,
          currency: params.line.currency,
          reservationId: params.line.reservationId,
          batchCode: params.line.batchCode,
          serialNumbers: params.line.serialNumbers,
          metadata: { kind: "ADJUSTMENT" },
        },
      ];
    }
    case InventoryDocumentType.COUNT: {
      const warehouseId = sourceWarehouseId ?? destinationWarehouseId;
      const locationId = sourceLocationId ?? destinationLocationId;
      if (!warehouseId) {
        throw new InventoryError("VALIDATION_ERROR", "COUNT line is missing warehouse");
      }
      return [
        {
          lineId: params.line.id,
          itemId: params.line.itemId,
          warehouseId,
          locationId,
          delta: params.line.quantity,
          unitCostMinor,
          currency: params.line.currency,
          reservationId: params.line.reservationId,
          batchCode: params.line.batchCode,
          serialNumbers: params.line.serialNumbers,
          metadata: { kind: "COUNT_RECONCILIATION", countedQty: params.line.quantity },
        },
      ];
    }
    default:
      return [];
  }
}

function mergeWorkflowHistory(
  steps: Prisma.JsonValue | null,
  next: { action: string; status: string; by: string; reason?: string | null },
): Prisma.JsonObject {
  const history = (steps as { history?: unknown } | null)?.history;
  const existing = Array.isArray(history) ? (history as Prisma.JsonArray) : [];
  const nextEntry: Prisma.JsonObject = {
    action: next.action,
    status: next.status,
    by: next.by,
    reason: next.reason ?? null,
    at: new Date().toISOString(),
  };
  return {
    history: [...existing, nextEntry] as Prisma.JsonArray,
  };
}

export async function applyInventoryDocumentAction(ctx: AppContext, documentId: string, input: unknown) {
  const parsed = documentActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid document action payload", parsed.error.flatten());
  }

  const action = parsed.data;

  const document = await prisma.inventoryDocument.findFirst({
    where: { id: documentId, companyId: ctx.companyId },
    include: {
      lines: true,
      workflow: true,
    },
  });

  if (!document) {
    throw new InventoryError("NOT_FOUND", "Document not found");
  }

  const totalValueMinor = document.lines.reduce(
    (sum, line) => sum + Math.abs(line.quantity) * (line.unitCostMinor ?? 0),
    0,
  );

  const transition = await resolveWorkflowTransition(ctx, {
    documentType: document.documentType,
    currentStatus: document.status,
    action: action.action,
    totalValueMinor,
  });

  for (const requiredPermission of transition.requiredPermissions) {
    if (!hasInventoryPermission(ctx.role, requiredPermission as (typeof inventoryPermissions)[keyof typeof inventoryPermissions])) {
      throw new InventoryError("FORBIDDEN", `Action requires permission '${requiredPermission}'`);
    }
  }

  if (action.action === "POST") {
    return postInventoryDocument(ctx, document.id, {
      idempotencyKey: action.idempotencyKey,
      allowNegativeOverride: action.allowNegativeOverride,
      reason: action.reason,
    });
  }

  const status = transition.to as InventoryDocumentStatus;

  const updated = await prisma.inventoryDocument.update({
    where: { id: document.id },
    data: {
      status,
      ...(status === InventoryDocumentStatus.SUBMITTED ? { submittedAt: new Date(), submittedBy: ctx.userId } : {}),
      ...(status === InventoryDocumentStatus.APPROVED ? { approvedAt: new Date(), approvedBy: ctx.userId } : {}),
      ...(status === InventoryDocumentStatus.REJECTED ? { rejectedAt: new Date(), rejectedBy: ctx.userId } : {}),
      ...(status === InventoryDocumentStatus.CANCELLED ? { cancelledAt: new Date(), cancelledBy: ctx.userId } : {}),
      updatedBy: ctx.userId,
      workflow: {
        upsert: {
          create: {
            companyId: ctx.companyId,
            currentStatus: status,
            steps: mergeWorkflowHistory(null, {
              action: action.action,
              status,
              by: ctx.userId,
              reason: action.reason,
            }),
            lastAction: action.action,
            lastActionBy: ctx.userId,
            lastActionAt: new Date(),
          },
          update: {
            currentStatus: status,
            steps: mergeWorkflowHistory(document.workflow?.steps ?? null, {
              action: action.action,
              status,
              by: ctx.userId,
              reason: action.reason,
            }),
            lastAction: action.action,
            lastActionBy: ctx.userId,
            lastActionAt: new Date(),
          },
        },
      },
    },
    include: {
      lines: true,
      workflow: true,
    },
  });

  await writeInventoryAudit(ctx, {
    action: `DOCUMENT_${action.action}`,
    entityType: "InventoryDocument",
    entityId: updated.id,
    before: document,
    after: updated,
    metadata: { reason: action.reason ?? null },
  });

  return updated;
}

export async function postInventoryDocument(
  ctx: AppContext,
  documentId: string,
  options: {
    idempotencyKey?: string;
    allowNegativeOverride?: boolean;
    reason?: string | null;
  },
) {
  const idempotencyScope = "INVENTORY_DOCUMENT_POST";

  if (options.idempotencyKey) {
    const keyRecord = await prisma.inventoryIdempotencyKey.findUnique({
      where: {
        companyId_scope_key: {
          companyId: ctx.companyId,
          scope: idempotencyScope,
          key: options.idempotencyKey,
        },
      },
    });

    if (keyRecord?.response) {
      return keyRecord.response;
    }
  }

  const settings = await getInventorySettings(ctx.companyId);

  const result = await prisma.$transaction(
    async (tx) => {
      const document = await tx.inventoryDocument.findFirst({
        where: { id: documentId, companyId: ctx.companyId },
        include: {
          lines: true,
          workflow: true,
        },
      });

      if (!document) {
        throw new InventoryError("NOT_FOUND", "Document not found");
      }

      if (document.status === InventoryDocumentStatus.POSTED) {
        return {
          documentId: document.id,
          status: document.status,
          alreadyPosted: true,
          postedAt: document.postedAt,
        };
      }

      if (document.status !== InventoryDocumentStatus.APPROVED) {
        throw new InventoryError("CONFLICT", "Only approved documents can be posted");
      }

      const allowNegativeOverride = Boolean(options.allowNegativeOverride);
      const canOverrideNegative = hasInventoryPermission(ctx.role, inventoryPermissions.overrideNegativeStock);

      if (allowNegativeOverride && !canOverrideNegative) {
        throw new InventoryError("FORBIDDEN", "Missing overrideNegativeStock permission");
      }

      const postingTimestamp = new Date();
      const movements: StockMovement[] = [];
      let reservationConsumedQty = 0;

      const uniqueItemIds = [...new Set(document.lines.map((line) => line.itemId))];
      const trackingProfiles = await tx.product.findMany({
        where: {
          companyId: ctx.companyId,
          id: { in: uniqueItemIds },
        },
        select: {
          id: true,
          trackSerial: true,
          trackBatch: true,
        },
      });

      if (trackingProfiles.length !== uniqueItemIds.length) {
        throw new InventoryError("VALIDATION_ERROR", "One or more document items are invalid");
      }

      const trackingByItem = new Map(trackingProfiles.map((profile) => [profile.id, profile]));

      for (const line of document.lines) {
        const tracking = trackingByItem.get(line.itemId);
        if (!tracking) {
          throw new InventoryError("VALIDATION_ERROR", `Missing tracking profile for item ${line.itemId}`);
        }

        const reservationId = lineReservationId(line);
        const batchCode = lineBatchCode(line);
        const serialNumbers = lineSerialNumbers(line);

        assertSerialBatchPayload({
          documentType: document.documentType,
          line: {
            quantity: line.quantity,
            itemId: line.itemId,
            serialNumbers,
            batchCode,
          },
          tracking,
        });

        const lineMovements = buildMovementsForLine({
          type: document.documentType,
          line: {
            id: line.id,
            itemId: line.itemId,
            quantity: line.quantity,
            unitCostMinor: line.unitCostMinor,
            currency: line.currency,
            sourceWarehouseId: line.sourceWarehouseId,
            sourceLocationId: line.sourceLocationId,
            destinationWarehouseId: line.destinationWarehouseId,
            destinationLocationId: line.destinationLocationId,
            reservationId,
            batchCode,
            serialNumbers,
          },
          docDefaults: {
            sourceWarehouseId: document.sourceWarehouseId,
            sourceLocationId: document.sourceLocationId,
            destinationWarehouseId: document.destinationWarehouseId,
            destinationLocationId: document.destinationLocationId,
          },
        });

        if (document.documentType === InventoryDocumentType.COUNT && lineMovements.length === 1) {
          const movement = lineMovements[0];
          const current = await tx.inventoryStockBalance.findFirst({
            where: {
              companyId: ctx.companyId,
              itemId: movement.itemId,
              warehouseId: movement.warehouseId,
              locationId: movement.locationId ?? null,
            },
            select: { onHand: true },
          });

          movement.delta = line.quantity - (current?.onHand ?? 0);
          movement.metadata = {
            ...movement.metadata,
            previousOnHand: current?.onHand ?? 0,
            countedQty: line.quantity,
          };
        }

        movements.push(...lineMovements);
      }

      for (const movement of movements) {
        await lockBalanceRow(
          tx,
          ctx.companyId,
          movement.itemId,
          movement.warehouseId,
          movement.locationId ?? null,
        );

        const existingBalance = await tx.inventoryStockBalance.findFirst({
          where: {
            companyId: ctx.companyId,
            itemId: movement.itemId,
            warehouseId: movement.warehouseId,
            locationId: movement.locationId ?? null,
          },
          select: {
            id: true,
            onHand: true,
            reserved: true,
            avgCostMinor: true,
          },
        });

        const previousOnHand = existingBalance?.onHand ?? 0;
        const nextOnHand = enforceNextOnHand({
          previousOnHand,
          delta: movement.delta,
          preventNegativeStock: settings.preventNegativeStock,
          allowNegativeOverride,
          itemId: movement.itemId,
          warehouseId: movement.warehouseId,
        });

        const nextAvgCost = computeAverageCost({
          previousOnHand,
          previousAvgCostMinor: existingBalance?.avgCostMinor ?? movement.unitCostMinor,
          delta: movement.delta,
          unitCostMinor: movement.unitCostMinor,
        });

        let nextReserved = existingBalance?.reserved ?? 0;
        if (movement.delta < 0 && movement.reservationId) {
          const consumed = await consumeInventoryReservationInTx(tx, {
            companyId: ctx.companyId,
            reservationId: movement.reservationId,
            itemId: movement.itemId,
            warehouseId: movement.warehouseId,
            locationId: movement.locationId ?? null,
            quantity: Math.abs(movement.delta),
            userId: ctx.userId,
          });
          reservationConsumedQty += consumed.consumedQty;
          nextReserved = Math.max(nextReserved - consumed.consumedQty, 0);
        }

        const batchId = await applyBatchMovementInTx(tx, {
          companyId: ctx.companyId,
          itemId: movement.itemId,
          warehouseId: movement.warehouseId,
          locationId: movement.locationId ?? null,
          batchCode: movement.batchCode ?? null,
          delta: movement.delta,
          metadata: {
            source: "document-posting",
            kind: movement.metadata.kind,
            postingTime: postingTimestamp.toISOString(),
          },
          userId: ctx.userId,
          preventNegativeStock: settings.preventNegativeStock,
          allowNegativeOverride,
        });

        await applySerialMovementInTx(tx, {
          companyId: ctx.companyId,
          itemId: movement.itemId,
          warehouseId: movement.warehouseId,
          locationId: movement.locationId ?? null,
          delta: movement.delta,
          serialNumbers: movement.serialNumbers,
          batchId,
          movementKind: String(movement.metadata.kind ?? "UNKNOWN"),
          userId: ctx.userId,
          postingTime: postingTimestamp,
        });

        await tx.inventoryLedgerEntry.create({
          data: {
            companyId: ctx.companyId,
            documentId: document.id,
            documentLineId: movement.lineId,
            itemId: movement.itemId,
            warehouseId: movement.warehouseId,
            locationId: movement.locationId,
            quantityDelta: movement.delta,
            unitCostMinor: movement.unitCostMinor,
            totalCostMinor: movement.delta * movement.unitCostMinor,
            currency: movement.currency,
            reservationId: movement.reservationId ?? null,
            batchCode: movement.batchCode ?? null,
            serialNumbers: (movement.serialNumbers ?? []) as Prisma.InputJsonValue,
            postingTime: postingTimestamp,
            metadata: {
              ...movement.metadata,
              reason: options.reason ?? null,
            },
            createdBy: ctx.userId,
          },
        });

        if (existingBalance) {
          await tx.inventoryStockBalance.update({
            where: { id: existingBalance.id },
            data: {
              onHand: nextOnHand,
              avgCostMinor: nextAvgCost,
              reserved: nextReserved,
            },
          });
        } else {
          await tx.inventoryStockBalance.create({
            data: {
              companyId: ctx.companyId,
              itemId: movement.itemId,
              warehouseId: movement.warehouseId,
              locationId: movement.locationId ?? null,
              onHand: nextOnHand,
              reserved: nextReserved,
              incoming: 0,
              outgoing: 0,
              avgCostMinor: nextAvgCost,
            },
          });
        }
      }

      const posted = await tx.inventoryDocument.update({
        where: { id: document.id },
        data: {
          status: InventoryDocumentStatus.POSTED,
          postedAt: postingTimestamp,
          postedBy: ctx.userId,
          updatedBy: ctx.userId,
          workflow: {
            upsert: {
              create: {
                companyId: ctx.companyId,
                currentStatus: InventoryDocumentStatus.POSTED,
                steps: mergeWorkflowHistory(null, {
                  action: "POST",
                  status: InventoryDocumentStatus.POSTED,
                  by: ctx.userId,
                  reason: options.reason,
                }),
                lastAction: "POST",
                lastActionBy: ctx.userId,
                lastActionAt: postingTimestamp,
              },
              update: {
                currentStatus: InventoryDocumentStatus.POSTED,
                steps: mergeWorkflowHistory(document.workflow?.steps ?? null, {
                  action: "POST",
                  status: InventoryDocumentStatus.POSTED,
                  by: ctx.userId,
                  reason: options.reason,
                }),
                lastAction: "POST",
                lastActionBy: ctx.userId,
                lastActionAt: postingTimestamp,
              },
            },
          },
        },
      });

      return {
        documentId: posted.id,
        status: posted.status,
        postedAt: posted.postedAt,
        alreadyPosted: false,
        movementCount: movements.length,
        reservationConsumedQty,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  if (options.idempotencyKey) {
    await prisma.inventoryIdempotencyKey.upsert({
      where: {
        companyId_scope_key: {
          companyId: ctx.companyId,
          scope: idempotencyScope,
          key: options.idempotencyKey,
        },
      },
      create: {
        companyId: ctx.companyId,
        scope: idempotencyScope,
        key: options.idempotencyKey,
        response: result,
        createdBy: ctx.userId,
      },
      update: {
        response: result,
        createdBy: ctx.userId,
      },
    });
  }

  await writeInventoryAudit(ctx, {
    action: "DOCUMENT_POSTED",
    entityType: "InventoryDocument",
    entityId: documentId,
    after: result,
    metadata: {
      reason: options.reason ?? null,
      idempotencyKey: options.idempotencyKey ?? null,
      movementCount:
        typeof (result as { movementCount?: unknown }).movementCount === "number"
          ? (result as { movementCount: number }).movementCount
          : null,
      reservationConsumedQty:
        typeof (result as { reservationConsumedQty?: unknown }).reservationConsumedQty === "number"
          ? (result as { reservationConsumedQty: number }).reservationConsumedQty
          : null,
    },
  });

  return result;
}

export async function listInventoryLedger(ctx: AppContext, input: unknown) {
  const parsed = ledgerQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid ledger query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.InventoryLedgerEntryWhereInput = {
    companyId: ctx.companyId,
    ...(q.itemId ? { itemId: q.itemId } : {}),
    ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
    ...(q.documentId ? { documentId: q.documentId } : {}),
    ...(q.from || q.to
      ? {
          postingTime: {
            ...(q.from ? { gte: q.from } : {}),
            ...(q.to ? { lte: q.to } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.inventoryLedgerEntry.findMany({
      where,
      include: {
        item: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ postingTime: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.inventoryLedgerEntry.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function listInventoryBalances(ctx: AppContext, input: unknown) {
  const parsed = ledgerQuerySchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid balance query", parsed.error.flatten());
  }

  const q = parsed.data;

  return prisma.inventoryStockBalance.findMany({
    where: {
      companyId: ctx.companyId,
      ...(q.itemId ? { itemId: q.itemId } : {}),
      ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
    },
    include: {
      item: { select: { id: true, sku: true, name: true, uom: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      location: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ itemId: "asc" }, { warehouseId: "asc" }],
  });
}
