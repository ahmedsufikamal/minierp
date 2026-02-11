import {
  InventoryDocumentStatus,
  InventoryDocumentType,
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
  metadata: Record<string, unknown>;
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
  const existing = (steps as { history?: Array<Record<string, unknown>> } | null)?.history ?? [];
  return {
    history: [
      ...existing,
      {
        action: next.action,
        status: next.status,
        by: next.by,
        reason: next.reason ?? null,
        at: new Date().toISOString(),
      },
    ],
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

      for (const line of document.lines) {
        const lineMovements = buildMovementsForLine({
          type: document.documentType,
          line,
          docDefaults: {
            sourceWarehouseId: document.sourceWarehouseId,
            sourceLocationId: document.sourceLocationId,
            destinationWarehouseId: document.destinationWarehouseId,
            destinationLocationId: document.destinationLocationId,
          },
        });

        if (document.documentType === InventoryDocumentType.COUNT && lineMovements.length === 1) {
          const movement = lineMovements[0];
          const current = await tx.inventoryStockBalance.findUnique({
            where: {
              companyId_itemId_warehouseId_locationId: {
                companyId: ctx.companyId,
                itemId: movement.itemId,
                warehouseId: movement.warehouseId,
                locationId: movement.locationId ?? null,
              },
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

        const existingBalance = await tx.inventoryStockBalance.findUnique({
          where: {
            companyId_itemId_warehouseId_locationId: {
              companyId: ctx.companyId,
              itemId: movement.itemId,
              warehouseId: movement.warehouseId,
              locationId: movement.locationId ?? null,
            },
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
            postingTime: postingTimestamp,
            metadata: {
              ...movement.metadata,
              reason: options.reason ?? null,
            },
            createdBy: ctx.userId,
          },
        });

        await tx.inventoryStockBalance.upsert({
          where: {
            companyId_itemId_warehouseId_locationId: {
              companyId: ctx.companyId,
              itemId: movement.itemId,
              warehouseId: movement.warehouseId,
              locationId: movement.locationId ?? null,
            },
          },
          create: {
            companyId: ctx.companyId,
            itemId: movement.itemId,
            warehouseId: movement.warehouseId,
            locationId: movement.locationId,
            onHand: nextOnHand,
            reserved: 0,
            incoming: 0,
            outgoing: 0,
            avgCostMinor: nextAvgCost,
          },
          update: {
            onHand: nextOnHand,
            avgCostMinor: nextAvgCost,
          },
        });
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
