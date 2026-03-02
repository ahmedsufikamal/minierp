import {
  InventoryDocumentStatus,
  InventoryDocumentType,
  InventorySerialStatus,
  Prisma,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { allocateSeriesNumber } from "@/modules/platform/application/numbering.service";
import {
  documentActionSchema,
  documentListQuerySchema,
  documentUpsertSchema,
  ledgerQuerySchema,
} from "@/modules/inventory/application/schemas";
import { hasInventoryPermission } from "@/modules/inventory/application/policy";
import { consumeInventoryReservationInTx } from "@/modules/inventory/application/reservations.service";
import {
  loadStockSettings,
  shouldBlockByFreezeWindow,
  type InventoryStockSettings,
} from "@/modules/inventory/application/stock-settings.service";
import { resolveWorkflowTransition } from "@/modules/inventory/application/workflow.service";
import { InventoryError } from "@/modules/inventory/domain/errors";
import { computeAverageCost, enforceNextOnHand } from "@/modules/inventory/domain/posting";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";
import {
  advisoryLockInventoryScopeInTx,
  withSerializableRetry,
} from "@/modules/inventory/infrastructure/tx";

type AppContext = Omit<InventoryRequestContext, "role"> & { role: import("@/modules/inventory/domain/types").InventoryRole };
type InventoryDocumentPostResult = {
  documentId: string;
  status: InventoryDocumentStatus;
  alreadyPosted: boolean;
  postedAt: string | null;
  movementCount?: number;
  reservationConsumedQty?: number;
};

type FifoAllocation = {
  layerId: string | null;
  qty: number;
  unitCostMinor: number;
  currency: string;
  sourceDocumentId: string | null;
  sourceLineId: string | null;
  batchId: string | null;
  serialId: string | null;
};

function pageToSkip(page: number, limit: number) {
  return Math.max(0, (page - 1) * limit);
}

type DocumentAdvancedFilterInput = {
  field: "id" | "stockEntryType" | "sourceWarehouseId" | "targetWarehouseId" | "status" | "createdOn";
  op: "equals" | "contains";
  value: string;
};

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildDocumentIdContainsCondition(term: string): Prisma.InventoryDocumentWhereInput {
  return {
    OR: [
      { number: { contains: term, mode: "insensitive" } },
      { id: { contains: term, mode: "insensitive" } },
      { externalRef: { contains: term, mode: "insensitive" } },
    ],
  };
}

function buildDocumentIdEqualsCondition(term: string): Prisma.InventoryDocumentWhereInput {
  return {
    OR: [
      { number: { equals: term, mode: "insensitive" } },
      { id: { equals: term, mode: "insensitive" } },
      { externalRef: { equals: term, mode: "insensitive" } },
    ],
  };
}

function matchDocumentTypes(term: string): InventoryDocumentType[] {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return [];
  return Object.values(InventoryDocumentType).filter((value) =>
    value.toLowerCase().includes(normalized),
  );
}

function matchDocumentStatuses(term: string): InventoryDocumentStatus[] {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return [];
  return Object.values(InventoryDocumentStatus).filter((value) =>
    value.toLowerCase().includes(normalized),
  );
}

function buildAdvancedDocumentFilterCondition(
  filter: DocumentAdvancedFilterInput,
): Prisma.InventoryDocumentWhereInput | null {
  const value = filter.value.trim();
  if (!value) return null;

  switch (filter.field) {
    case "id":
      return filter.op === "equals"
        ? buildDocumentIdEqualsCondition(value)
        : buildDocumentIdContainsCondition(value);
    case "stockEntryType":
      if (filter.op === "equals") {
        const matched = Object.values(InventoryDocumentType).find(
          (entry) => entry.toLowerCase() === value.toLowerCase(),
        );
        return matched ? { documentType: matched } : null;
      }
      {
        const matches = matchDocumentTypes(value);
        return matches.length > 0 ? { documentType: { in: matches } } : null;
      }
    case "sourceWarehouseId":
      return filter.op === "equals" ? { sourceWarehouseId: value } : null;
    case "targetWarehouseId":
      return filter.op === "equals" ? { destinationWarehouseId: value } : null;
    case "status":
      if (filter.op === "equals") {
        const matched = Object.values(InventoryDocumentStatus).find(
          (entry) => entry.toLowerCase() === value.toLowerCase(),
        );
        return matched ? { status: matched } : null;
      }
      {
        const matches = matchDocumentStatuses(value);
        return matches.length > 0 ? { status: { in: matches } } : null;
      }
    case "createdOn":
      return null;
    default:
      return null;
  }
}

function defaultSortDirectionForField(
  field:
    | "created_on"
    | "last_updated_on"
    | "stock_entry_type"
    | "id"
    | "default_source_warehouse"
    | "default_target_warehouse"
    | undefined,
): Prisma.SortOrder {
  switch (field) {
    case "stock_entry_type":
    case "id":
    case "default_source_warehouse":
    case "default_target_warehouse":
      return "asc";
    case "last_updated_on":
    case "created_on":
    default:
      return "desc";
  }
}

function resolveDocumentListOrderBy(params: {
  sortField?:
    | "created_on"
    | "last_updated_on"
    | "stock_entry_type"
    | "id"
    | "default_source_warehouse"
    | "default_target_warehouse";
  sortDirection?: Prisma.SortOrder;
}): Prisma.InventoryDocumentOrderByWithRelationInput[] {
  const direction = params.sortDirection ?? defaultSortDirectionForField(params.sortField);

  switch (params.sortField) {
    case "last_updated_on":
      return [{ updatedAt: direction }, { createdAt: "desc" }];
    case "stock_entry_type":
      return [{ documentType: direction }, { createdAt: "desc" }];
    case "id":
      return [{ number: direction }, { createdAt: "desc" }];
    case "default_source_warehouse":
      return [{ sourceWarehouse: { code: direction } }, { createdAt: "desc" }];
    case "default_target_warehouse":
      return [{ destinationWarehouse: { code: direction } }, { createdAt: "desc" }];
    case "created_on":
    default:
      return [{ createdAt: direction }];
  }
}

function hashIdempotencyRequest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
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

function parseStoredPostResult(value: Prisma.JsonValue | null): InventoryDocumentPostResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.documentId !== "string" || typeof record.status !== "string") return null;

  return {
    documentId: record.documentId,
    status: record.status as InventoryDocumentStatus,
    alreadyPosted: Boolean(record.alreadyPosted),
    postedAt: typeof record.postedAt === "string" ? record.postedAt : null,
    ...(typeof record.movementCount === "number" ? { movementCount: record.movementCount } : {}),
    ...(typeof record.reservationConsumedQty === "number"
      ? { reservationConsumedQty: record.reservationConsumedQty }
      : {}),
  };
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
      documentSeriesCode: "INV-DOC",
      costingMethod: "AVG",
      baseCurrency: "BDT",
      id: "default",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }
  );
}

function canBypassStockFreeze(ctx: AppContext) {
  return hasInventoryPermission(ctx.role, inventoryPermissions.settingsWrite);
}

function assertFreezeWindow(params: {
  ctx: AppContext;
  settings: InventoryStockSettings;
  documentDate: Date;
  operation: string;
}) {
  if (canBypassStockFreeze(params.ctx)) return;
  if (!shouldBlockByFreezeWindow(params.settings, params.documentDate)) return;

  throw new InventoryError(
    "CONFLICT",
    `${params.operation} is blocked: document date is older than freeze threshold (${params.settings.freeze_stocks_older_than_days} days)`,
  );
}

async function resolveDocumentNumber(
  ctx: AppContext,
  input: { number?: string; documentType: InventoryDocumentType },
): Promise<string> {
  const explicitNumber = input.number?.trim();
  if (explicitNumber) return explicitNumber;

  const settings = await getInventorySettings(ctx.companyId);
  const seriesKey = settings.documentSeriesCode?.trim() || "INV-DOC";

  try {
    const allocated = await allocateSeriesNumber(
      {
        requestId: ctx.requestId,
        tenantId: ctx.tenantId ?? ctx.companyId,
        companyId: ctx.companyId,
        userId: ctx.userId,
        role: ctx.role,
        platformRole: "NONE",
        permissions: ctx.iamPermissions ?? [],
      },
      {
        key: seriesKey,
        companyId: ctx.companyId,
        date: new Date(),
      },
    );

    return allocated.number;
  } catch {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const prefix = input.documentType.slice(0, 3);
    return `${prefix}-${stamp}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  }
}

export async function listInventoryDocuments(ctx: AppContext, input: unknown) {
  const parsed = documentListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid document query", parsed.error.flatten());
  }

  const q = parsed.data;
  const andConditions: Prisma.InventoryDocumentWhereInput[] = [];

  if (hasText(q.q)) {
    andConditions.push({
      OR: [
        { number: { contains: q.q, mode: "insensitive" } },
        { externalRef: { contains: q.q, mode: "insensitive" } },
        { notes: { contains: q.q, mode: "insensitive" } },
      ],
    });
  }

  if (hasText(q.id)) {
    andConditions.push(buildDocumentIdContainsCondition(q.id));
  }

  if (hasText(q.sourceWarehouseId)) {
    andConditions.push({ sourceWarehouseId: q.sourceWarehouseId });
  }

  if (hasText(q.destinationWarehouseId)) {
    andConditions.push({ destinationWarehouseId: q.destinationWarehouseId });
  }

  for (const filter of q.filters) {
    const condition = buildAdvancedDocumentFilterCondition(filter as DocumentAdvancedFilterInput);
    if (condition) {
      andConditions.push(condition);
    }
  }

  const where: Prisma.InventoryDocumentWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.type ? { documentType: q.type } : {}),
    ...(andConditions.length > 0 ? { AND: andConditions } : {}),
  };
  const orderBy = resolveDocumentListOrderBy({
    sortField: q.sortField,
    sortDirection: q.sortDirection,
  });

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
      orderBy,
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
        orderBy: [{ postingSeq: "desc" }, { postingTime: "desc" }],
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

  const stockSettings = await loadStockSettings(ctx.companyId);
  const documentDate = parsed.data.documentDate ?? new Date();
  assertFreezeWindow({
    ctx,
    settings: stockSettings,
    documentDate,
    operation: "Creating stock document",
  });

  const documentNumber = await resolveDocumentNumber(ctx, {
    number: parsed.data.number,
    documentType: parsed.data.documentType,
  });

  assertDocumentSourceDestination(parsed.data);

  const existing = await prisma.inventoryDocument.findUnique({
    where: {
      companyId_number: {
        companyId: ctx.companyId,
        number: documentNumber,
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
      number: documentNumber,
      documentDate,
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

  const stockSettings = await loadStockSettings(ctx.companyId);
  const effectiveDocumentDate = parsed.data.documentDate ?? existing.documentDate;
  assertFreezeWindow({
    ctx,
    settings: stockSettings,
    documentDate: effectiveDocumentDate,
    operation: "Editing stock document",
  });

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
  defaultUnitCostMinor: number;
  currency: string;
  reservationId?: string | null;
  batchCode?: string | null;
  serialNumbers: string[];
  trackSerial: boolean;
  trackBatch: boolean;
  transferGroupId?: string | null;
  metadata: Record<string, unknown>;
};

type ItemTrackingProfile = {
  id: string;
  trackSerial: boolean;
  trackBatch: boolean;
  unitCostMinor: number | null;
};

async function lockBalanceRow(
  tx: Prisma.TransactionClient,
  companyId: string,
  itemId: string,
  warehouseId: string,
  locationId: string | null,
): Promise<void> {
  await advisoryLockInventoryScopeInTx(tx, {
    companyId,
    itemId,
    warehouseId,
    locationId,
  });

  await tx.$queryRaw`
    SELECT 1
    FROM "InventoryStockBalance"
    WHERE "orgId" = ${companyId}
      AND "itemId" = ${itemId}
      AND "warehouseId" = ${warehouseId}
      AND ("locationId" IS NOT DISTINCT FROM ${locationId})
    FOR UPDATE
  `;
}

async function lockBatchRow(
  tx: Prisma.TransactionClient,
  companyId: string,
  itemId: string,
  warehouseId: string,
  locationId: string | null,
  batchCode: string,
): Promise<void> {
  await advisoryLockInventoryScopeInTx(tx, {
    companyId,
    itemId,
    warehouseId,
    locationId,
  });

  await tx.$queryRaw`
    SELECT 1
    FROM "InventoryBatch"
    WHERE "orgId" = ${companyId}
      AND "itemId" = ${itemId}
      AND "warehouseId" = ${warehouseId}
      AND ("locationId" IS NOT DISTINCT FROM ${locationId})
      AND "batchCode" = ${batchCode}
    FOR UPDATE
  `;
}

async function createFifoLayerInTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    itemId: string;
    warehouseId: string;
    locationId: string | null;
    qty: number;
    unitCostMinor: number;
    currency: string;
    sourceDocumentId: string;
    sourceLineId: string;
    sourceLedgerEntryId?: string | null;
    batchId?: string | null;
    serialId?: string | null;
    userId: string;
    metadata?: Record<string, unknown>;
  },
) {
  if (params.qty <= 0) return;
  return tx.inventoryCostLayer.create({
    data: {
      companyId: params.companyId,
      itemId: params.itemId,
      warehouseId: params.warehouseId,
      locationId: params.locationId,
      sourceDocumentId: params.sourceDocumentId,
      sourceLineId: params.sourceLineId,
      sourceLedgerEntryId: params.sourceLedgerEntryId ?? null,
      batchId: params.batchId ?? null,
      serialId: params.serialId ?? null,
      qtyRemaining: params.qty,
      unitCostMinor: params.unitCostMinor,
      currency: params.currency,
      createdBy: params.userId,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

async function consumeFifoLayersDetailedInTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    itemId: string;
    warehouseId: string;
    locationId: string | null;
    quantity: number;
    transferGroupId?: string | null;
    documentId?: string | null;
    documentLineId?: string | null;
    ledgerEntryId?: string | null;
    movementKind: string;
    batchId?: string | null;
    serialIds?: string[];
  },
): Promise<{ consumedQty: number; totalCostMinor: number; allocations: FifoAllocation[] }> {
  let remaining = Math.max(0, params.quantity);
  let consumedQty = 0;
  let totalCostMinor = 0;
  const allocations: FifoAllocation[] = [];

  if (remaining === 0) {
    return { consumedQty: 0, totalCostMinor: 0, allocations };
  }

  const layers = await tx.inventoryCostLayer.findMany({
    where: {
      companyId: params.companyId,
      itemId: params.itemId,
      warehouseId: params.warehouseId,
      locationId: params.locationId,
      qtyRemaining: { gt: 0 },
      ...(params.batchId ? { batchId: params.batchId } : {}),
      ...(params.serialIds && params.serialIds.length > 0 ? { serialId: { in: params.serialIds } } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 2000,
  });

  for (const layer of layers) {
    if (remaining <= 0) break;
    const takeQty = Math.min(remaining, layer.qtyRemaining);
    if (takeQty <= 0) continue;

    remaining -= takeQty;
    consumedQty += takeQty;
    totalCostMinor += takeQty * layer.unitCostMinor;
    allocations.push({
      layerId: layer.id,
      qty: takeQty,
      unitCostMinor: layer.unitCostMinor,
      currency: layer.currency,
      sourceDocumentId: layer.sourceDocumentId ?? null,
      sourceLineId: layer.sourceLineId ?? null,
      batchId: layer.batchId ?? null,
      serialId: layer.serialId ?? null,
    });

    await tx.inventoryCostLayer.update({
      where: { id: layer.id },
      data: {
        qtyRemaining: layer.qtyRemaining - takeQty,
      },
    });

    await tx.inventoryCostLayerAllocation.create({
      data: {
        companyId: params.companyId,
        transferGroupId: params.transferGroupId ?? null,
        sourceLayerId: layer.id,
        destinationLayerId: null,
        documentId: params.documentId ?? null,
        documentLineId: params.documentLineId ?? null,
        ledgerEntryId: params.ledgerEntryId ?? null,
        movementKind: params.movementKind,
        qty: takeQty,
        unitCostMinor: layer.unitCostMinor,
        currency: layer.currency,
      },
    });
  }

  return { consumedQty, totalCostMinor, allocations };
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
    allowNegativeStock: boolean;
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
    allowNegativeStock: params.allowNegativeStock,
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
    receiptUnitCostMinor?: number | null;
    receiptCurrency?: string | null;
    receiptLedgerEntryId?: string | null;
    enforceOutboundCost?: boolean;
  },
): Promise<{ outboundCostMinor: number }> {
  if (params.serialNumbers.length === 0) {
    return { outboundCostMinor: 0 };
  }

  let outboundCostMinor = 0;

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

      if ((params.enforceOutboundCost ?? true) && existing.receiptUnitCostMinor == null) {
        throw new InventoryError(
          "CONFLICT",
          `Serial '${serialNumber}' is missing receipt costing and cannot be issued`,
        );
      }
      outboundCostMinor += existing.receiptUnitCostMinor ?? 0;

      const nextStatus =
        params.movementKind === "TRANSFER_OUT"
          ? InventorySerialStatus.RESERVED
          : InventorySerialStatus.ISSUED;

      await tx.inventorySerial.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          batchId: params.batchId ?? existing.batchId,
          warehouseId: null,
          locationId: null,
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
          receiptUnitCostMinor: existing.receiptUnitCostMinor ?? params.receiptUnitCostMinor ?? null,
          receiptCurrency: existing.receiptCurrency ?? params.receiptCurrency ?? null,
          receiptLedgerEntryId: existing.receiptLedgerEntryId ?? params.receiptLedgerEntryId ?? null,
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
        receiptUnitCostMinor: params.receiptUnitCostMinor ?? null,
        receiptCurrency: params.receiptCurrency ?? null,
        receiptLedgerEntryId: params.receiptLedgerEntryId ?? null,
        metadata: {
          createdByMovementKind: params.movementKind,
          createdAt: params.postingTime.toISOString(),
        },
        createdBy: params.userId,
      },
    });
  }

  return { outboundCostMinor };
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
          defaultUnitCostMinor: unitCostMinor,
          currency: params.line.currency,
          reservationId: params.line.reservationId,
          batchCode: params.line.batchCode,
          serialNumbers: params.line.serialNumbers,
          trackSerial: false,
          trackBatch: false,
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
          defaultUnitCostMinor: unitCostMinor,
          currency: params.line.currency,
          reservationId: params.line.reservationId,
          batchCode: params.line.batchCode,
          serialNumbers: params.line.serialNumbers,
          trackSerial: false,
          trackBatch: false,
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
          defaultUnitCostMinor: unitCostMinor,
          currency: params.line.currency,
          reservationId: params.line.reservationId,
          batchCode: params.line.batchCode,
          serialNumbers: params.line.serialNumbers,
          trackSerial: false,
          trackBatch: false,
          metadata: { kind: "TRANSFER_OUT" },
        },
        {
          lineId: params.line.id,
          itemId: params.line.itemId,
          warehouseId: destinationWarehouseId,
          locationId: destinationLocationId,
          delta: qtyAbs,
          unitCostMinor,
          defaultUnitCostMinor: unitCostMinor,
          currency: params.line.currency,
          reservationId: params.line.reservationId,
          batchCode: params.line.batchCode,
          serialNumbers: params.line.serialNumbers,
          trackSerial: false,
          trackBatch: false,
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
          defaultUnitCostMinor: unitCostMinor,
          currency: params.line.currency,
          reservationId: params.line.reservationId,
          batchCode: params.line.batchCode,
          serialNumbers: params.line.serialNumbers,
          trackSerial: false,
          trackBatch: false,
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
          defaultUnitCostMinor: unitCostMinor,
          currency: params.line.currency,
          reservationId: params.line.reservationId,
          batchCode: params.line.batchCode,
          serialNumbers: params.line.serialNumbers,
          trackSerial: false,
          trackBatch: false,
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

  if (action.action === "SUBMIT" || action.action === "APPROVE") {
    const stockSettings = await loadStockSettings(ctx.companyId);
    assertFreezeWindow({
      ctx,
      settings: stockSettings,
      documentDate: document.documentDate,
      operation: `${action.action} for stock document`,
    });
  }

  if (action.action === "POST") {
    if (!action.idempotencyKey?.trim()) {
      throw new InventoryError("VALIDATION_ERROR", "Idempotency key is required for document posting");
    }
    return postInventoryDocument(ctx, document.id, {
      idempotencyKey: action.idempotencyKey,
      allowNegativeOverride: action.allowNegativeOverride,
      reason: action.reason,
    });
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
): Promise<InventoryDocumentPostResult> {
  const idempotencyScope = "INVENTORY_DOCUMENT_POST";
  const idempotencyKey = options.idempotencyKey?.trim();
  if (!idempotencyKey) {
    throw new InventoryError("VALIDATION_ERROR", "Idempotency key is required for posting");
  }
  const requestHash = hashIdempotencyRequest({
    documentId,
    allowNegativeOverride: Boolean(options.allowNegativeOverride),
    reason: options.reason ?? null,
  });

  const stockSettings = await loadStockSettings(ctx.companyId);
  const result = await withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const idempotencyRecord = await tx.inventoryIdempotencyKey.findUnique({
          where: {
            companyId_scope_key: {
              companyId: ctx.companyId,
              scope: idempotencyScope,
              key: idempotencyKey,
            },
          },
        });

        if (idempotencyRecord?.requestHash && idempotencyRecord.requestHash !== requestHash) {
          throw new InventoryError("CONFLICT", "Idempotency key cannot be reused with a different payload");
        }
        if (idempotencyRecord?.response) {
          const cached = parseStoredPostResult(idempotencyRecord.response);
          if (cached) {
            return cached;
          }
        }

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
          const alreadyPostedResult: InventoryDocumentPostResult = {
            documentId: document.id,
            status: document.status,
            alreadyPosted: true,
            postedAt: document.postedAt ? document.postedAt.toISOString() : null,
          };
          await tx.inventoryIdempotencyKey.upsert({
            where: {
              companyId_scope_key: {
                companyId: ctx.companyId,
                scope: idempotencyScope,
                key: idempotencyKey,
              },
            },
            create: {
              companyId: ctx.companyId,
              scope: idempotencyScope,
              key: idempotencyKey,
              requestHash,
              response: alreadyPostedResult as Prisma.InputJsonValue,
              createdBy: ctx.userId,
            },
            update: {
              requestHash,
              response: alreadyPostedResult as Prisma.InputJsonValue,
              createdBy: ctx.userId,
            },
          });
          return alreadyPostedResult;
        }

        if (document.status !== InventoryDocumentStatus.APPROVED) {
          throw new InventoryError("CONFLICT", "Only approved documents can be posted");
        }

        assertFreezeWindow({
          ctx,
          settings: stockSettings,
          documentDate: document.documentDate,
          operation: "Posting stock document",
        });

        const allowNegativeOverride = Boolean(options.allowNegativeOverride);
        const canOverrideNegative = hasInventoryPermission(ctx.role, inventoryPermissions.overrideNegativeStock);

        if (allowNegativeOverride && !canOverrideNegative) {
          throw new InventoryError("FORBIDDEN", "Missing overrideNegativeStock permission");
        }

        const postingTimestamp = new Date();
        const movements: StockMovement[] = [];
        let reservationConsumedQty = 0;
        const transferAllocationsByLine = new Map<string, FifoAllocation[]>();

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
            unitCostMinor: true,
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

          const transferGroupId =
            document.documentType === InventoryDocumentType.TRANSFER ? randomUUID() : null;
          for (const movement of lineMovements) {
            movement.trackSerial = tracking.trackSerial;
            movement.trackBatch = tracking.trackBatch;
            movement.defaultUnitCostMinor = tracking.unitCostMinor ?? movement.unitCostMinor;
            movement.transferGroupId = transferGroupId;
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
              stockValueMinor: true,
            },
          });

          const previousOnHand = existingBalance?.onHand ?? 0;
          const previousAvg = existingBalance?.avgCostMinor ?? movement.defaultUnitCostMinor;
          const previousStockValue = existingBalance?.stockValueMinor ?? previousOnHand * previousAvg;

          let batchIdFromExisting: string | null = null;
          if (movement.trackBatch && movement.batchCode) {
            await lockBatchRow(
              tx,
              ctx.companyId,
              movement.itemId,
              movement.warehouseId,
              movement.locationId ?? null,
              movement.batchCode,
            );

            const existingBatch = await tx.inventoryBatch.findFirst({
              where: {
                companyId: ctx.companyId,
                itemId: movement.itemId,
                warehouseId: movement.warehouseId,
                locationId: movement.locationId ?? null,
                batchCode: movement.batchCode,
              },
              select: { id: true },
            });
            if (movement.delta < 0 && !existingBatch) {
              throw new InventoryError(
                "CONFLICT",
                `Batch '${movement.batchCode}' is not available for outbound movement`,
              );
            }
            batchIdFromExisting = existingBatch?.id ?? null;
          }

          if (movement.delta > 0 && movement.trackBatch && movement.batchCode && !batchIdFromExisting) {
            batchIdFromExisting = await applyBatchMovementInTx(tx, {
              companyId: ctx.companyId,
              itemId: movement.itemId,
              warehouseId: movement.warehouseId,
              locationId: movement.locationId ?? null,
              batchCode: movement.batchCode,
              delta: 0,
              metadata: {
                source: "document-posting",
                kind: "BATCH_PREPARE",
                postingTime: postingTimestamp.toISOString(),
              },
              userId: ctx.userId,
              allowNegativeStock: stockSettings.allow_negative_stock,
              allowNegativeOverride,
            });
          }

          let serialOutboundCostMinor: number | null = null;
          let outboundSerialAlreadyMoved = false;
          if (movement.delta < 0 && movement.trackSerial && movement.serialNumbers.length > 0) {
            const serialResult = await applySerialMovementInTx(tx, {
              companyId: ctx.companyId,
              itemId: movement.itemId,
              warehouseId: movement.warehouseId,
              locationId: movement.locationId ?? null,
              delta: movement.delta,
              serialNumbers: movement.serialNumbers,
              batchId: batchIdFromExisting,
              movementKind: String(movement.metadata.kind ?? "UNKNOWN"),
              userId: ctx.userId,
              postingTime: postingTimestamp,
              enforceOutboundCost: true,
            });
            serialOutboundCostMinor = serialResult.outboundCostMinor;
            outboundSerialAlreadyMoved = true;
          }

          const nextOnHand = enforceNextOnHand({
            previousOnHand,
            delta: movement.delta,
            allowNegativeStock: stockSettings.allow_negative_stock,
            allowNegativeOverride,
            itemId: movement.itemId,
            warehouseId: movement.warehouseId,
          });

          let ledgerUnitCostMinor = movement.unitCostMinor;
          let ledgerTotalCostMinor = movement.delta * ledgerUnitCostMinor;
          const valuationMetadata: Record<string, unknown> = {
            method: stockSettings.default_valuation_method,
            fifoFallbackUsed: false,
          };

          if (movement.delta < 0) {
            const qtyAbs = Math.abs(movement.delta);

            if (movement.trackSerial && serialOutboundCostMinor != null) {
              const totalOutboundCost = serialOutboundCostMinor;
              ledgerUnitCostMinor = qtyAbs > 0 ? Math.round(totalOutboundCost / qtyAbs) : 0;
              ledgerTotalCostMinor = -totalOutboundCost;
              valuationMetadata.method = "SPECIFIC_ID";
              valuationMetadata.specificId = true;
            } else if (stockSettings.default_valuation_method === "FIFO") {
              const consumed = await consumeFifoLayersDetailedInTx(tx, {
                companyId: ctx.companyId,
                itemId: movement.itemId,
                warehouseId: movement.warehouseId,
                locationId: movement.locationId ?? null,
                quantity: qtyAbs,
                transferGroupId: movement.transferGroupId ?? null,
                documentId: document.id,
                documentLineId: movement.lineId,
                movementKind: String(movement.metadata.kind ?? "FIFO_OUT"),
                batchId: batchIdFromExisting,
              });

              let totalOutboundCost = consumed.totalCostMinor;
              let fallbackUsed = false;
              const transferAllocations = [...consumed.allocations];
              const remainder = qtyAbs - consumed.consumedQty;
              const fallbackUnitCost = existingBalance?.avgCostMinor ?? movement.defaultUnitCostMinor;
              const availableUnlayeredQty = Math.max(previousOnHand - consumed.consumedQty, 0);
              const fallbackQty = Math.min(remainder, availableUnlayeredQty);

              if (fallbackQty > 0) {
                totalOutboundCost += fallbackQty * fallbackUnitCost;
                fallbackUsed = true;
                transferAllocations.push({
                  layerId: null,
                  qty: fallbackQty,
                  unitCostMinor: fallbackUnitCost,
                  currency: movement.currency,
                  sourceDocumentId: null,
                  sourceLineId: null,
                  batchId: batchIdFromExisting,
                  serialId: null,
                });
              }

              const uncoveredQty = remainder - fallbackQty;
              if (uncoveredQty > 0) {
                if (!allowNegativeOverride) {
                  throw new InventoryError(
                    "CONFLICT",
                    `Insufficient FIFO layers for item ${movement.itemId} (${movement.warehouseId})`,
                  );
                }
                totalOutboundCost += uncoveredQty * fallbackUnitCost;
                fallbackUsed = true;
              }

              ledgerUnitCostMinor = qtyAbs > 0 ? Math.round(totalOutboundCost / qtyAbs) : movement.defaultUnitCostMinor;
              ledgerTotalCostMinor = -totalOutboundCost;
              valuationMetadata.fifoConsumedQty = consumed.consumedQty;
              valuationMetadata.fifoFallbackQty = fallbackQty;
              valuationMetadata.fifoFallbackUsed = fallbackUsed;
              valuationMetadata.allocations = transferAllocations.map((allocation) => ({
                layerId: allocation.layerId,
                qty: allocation.qty,
                unitCostMinor: allocation.unitCostMinor,
                currency: allocation.currency,
              }));

              if (movement.metadata.kind === "TRANSFER_OUT") {
                transferAllocationsByLine.set(movement.lineId, transferAllocations);
              }
            } else if (stockSettings.default_valuation_method === "STANDARD") {
              const standardUnitCost = movement.defaultUnitCostMinor;
              ledgerUnitCostMinor = standardUnitCost;
              ledgerTotalCostMinor = movement.delta * standardUnitCost;
              valuationMetadata.method = "STANDARD";
            } else {
              const baselineUnitCost = existingBalance?.avgCostMinor ?? movement.defaultUnitCostMinor;
              ledgerUnitCostMinor = baselineUnitCost;
              ledgerTotalCostMinor = movement.delta * baselineUnitCost;
            }
          } else if (movement.delta > 0) {
            if (movement.metadata.kind === "TRANSFER_IN" && stockSettings.default_valuation_method === "FIFO") {
              const allocations = transferAllocationsByLine.get(movement.lineId) ?? [];
              if (allocations.length === 0 && !allowNegativeOverride) {
                throw new InventoryError(
                  "CONFLICT",
                  `TRANSFER_IN for line ${movement.lineId} is missing source FIFO allocations`,
                );
              }

              if (allocations.length > 0) {
                let totalInboundCost = 0;
                for (const allocation of allocations) {
                  const destinationLayer = await createFifoLayerInTx(tx, {
                    companyId: ctx.companyId,
                    itemId: movement.itemId,
                    warehouseId: movement.warehouseId,
                    locationId: movement.locationId ?? null,
                    qty: allocation.qty,
                    unitCostMinor: allocation.unitCostMinor,
                    currency: allocation.currency,
                    sourceDocumentId: document.id,
                    sourceLineId: movement.lineId,
                    sourceLedgerEntryId: null,
                    batchId: movement.trackBatch ? batchIdFromExisting : allocation.batchId,
                    serialId: allocation.serialId,
                    userId: ctx.userId,
                    metadata: {
                      source: "document-posting",
                      movementKind: movement.metadata.kind,
                      transferPreserved: true,
                      transferGroupId: movement.transferGroupId,
                    },
                  });

                  if (destinationLayer && allocation.layerId) {
                    await tx.inventoryCostLayerAllocation.create({
                      data: {
                        companyId: ctx.companyId,
                        transferGroupId: movement.transferGroupId ?? null,
                        sourceLayerId: allocation.layerId,
                        destinationLayerId: destinationLayer.id,
                        documentId: document.id,
                        documentLineId: movement.lineId,
                        ledgerEntryId: null,
                        movementKind: "TRANSFER_IN",
                        qty: allocation.qty,
                        unitCostMinor: allocation.unitCostMinor,
                        currency: allocation.currency,
                      },
                    });
                  }

                  totalInboundCost += allocation.qty * allocation.unitCostMinor;
                }

                ledgerUnitCostMinor =
                  movement.delta > 0 ? Math.round(totalInboundCost / movement.delta) : movement.defaultUnitCostMinor;
                ledgerTotalCostMinor = totalInboundCost;
                valuationMetadata.transferLayerPreserved = true;
                valuationMetadata.allocations = allocations.map((allocation) => ({
                  layerId: allocation.layerId,
                  qty: allocation.qty,
                  unitCostMinor: allocation.unitCostMinor,
                  currency: allocation.currency,
                }));
              }
            } else if (stockSettings.default_valuation_method === "STANDARD") {
              ledgerUnitCostMinor = movement.defaultUnitCostMinor;
              ledgerTotalCostMinor = movement.delta * ledgerUnitCostMinor;
              valuationMetadata.method = "STANDARD";
            }
          }

          const nextAvgCost = computeAverageCost({
            previousOnHand,
            previousAvgCostMinor: previousAvg,
            delta: movement.delta,
            unitCostMinor: ledgerUnitCostMinor,
          });

          let nextReserved = existingBalance?.reserved ?? 0;
          let reservationConsumedOnMovement = 0;
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
            reservationConsumedOnMovement = consumed.consumedQty;
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
            allowNegativeStock: stockSettings.allow_negative_stock,
            allowNegativeOverride,
          });
          const effectiveBatchId = batchId ?? batchIdFromExisting;

          const nextStockValueMinor = previousStockValue + ledgerTotalCostMinor;

          const ledgerEntry = await tx.inventoryLedgerEntry.create({
            data: {
              companyId: ctx.companyId,
              documentId: document.id,
              documentLineId: movement.lineId,
              itemId: movement.itemId,
              warehouseId: movement.warehouseId,
              locationId: movement.locationId,
              quantityDelta: movement.delta,
              unitCostMinor: ledgerUnitCostMinor,
              totalCostMinor: ledgerTotalCostMinor,
              currency: movement.currency,
              reservationId: movement.reservationId ?? null,
              batchCode: movement.batchCode ?? null,
              serialNumbers: (movement.serialNumbers ?? []) as Prisma.InputJsonValue,
              transferGroupId: movement.transferGroupId ?? null,
              postingTime: postingTimestamp,
              metadata: ({
                ...movement.metadata,
                valuation: valuationMetadata as Prisma.InputJsonValue,
                reason: options.reason ?? null,
                idempotencyKey,
              }) as Prisma.InputJsonValue,
              createdBy: ctx.userId,
            },
          });

          if (stockSettings.default_valuation_method === "FIFO") {
            await tx.inventoryCostLayerAllocation.updateMany({
              where: {
                companyId: ctx.companyId,
                documentId: document.id,
                documentLineId: movement.lineId,
                movementKind: String(movement.metadata.kind ?? "UNKNOWN"),
                transferGroupId: movement.transferGroupId ?? null,
                ledgerEntryId: null,
              },
              data: {
                ledgerEntryId: ledgerEntry.id,
              },
            });

            if (movement.delta > 0 && movement.metadata.kind !== "TRANSFER_IN") {
              await createFifoLayerInTx(tx, {
                companyId: ctx.companyId,
                itemId: movement.itemId,
                warehouseId: movement.warehouseId,
                locationId: movement.locationId ?? null,
                qty: movement.delta,
                unitCostMinor: ledgerUnitCostMinor,
                currency: movement.currency,
                sourceDocumentId: document.id,
                sourceLineId: movement.lineId,
                sourceLedgerEntryId: ledgerEntry.id,
                batchId: effectiveBatchId,
                serialId: null,
                userId: ctx.userId,
                metadata: {
                  source: "document-posting",
                  movementKind: movement.metadata.kind,
                },
              });
            }
          }

          if (movement.trackSerial && (!outboundSerialAlreadyMoved || movement.delta > 0)) {
            await applySerialMovementInTx(tx, {
              companyId: ctx.companyId,
              itemId: movement.itemId,
              warehouseId: movement.warehouseId,
              locationId: movement.locationId ?? null,
              delta: movement.delta,
              serialNumbers: movement.serialNumbers,
              batchId: effectiveBatchId,
              movementKind: String(movement.metadata.kind ?? "UNKNOWN"),
              userId: ctx.userId,
              postingTime: postingTimestamp,
              receiptUnitCostMinor: movement.delta > 0 ? ledgerUnitCostMinor : null,
              receiptCurrency: movement.delta > 0 ? movement.currency : null,
              receiptLedgerEntryId: movement.delta > 0 ? ledgerEntry.id : null,
              enforceOutboundCost: true,
            });
          }

          if (existingBalance) {
            await tx.inventoryStockBalance.update({
              where: { id: existingBalance.id },
              data: {
                onHand: nextOnHand,
                avgCostMinor: nextAvgCost,
                reserved: nextReserved,
                stockValueMinor: nextStockValueMinor,
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
                stockValueMinor: nextStockValueMinor,
              },
            });
          }

          await tx.inventoryOutboxEvent.create({
            data: {
              companyId: ctx.companyId,
              topic: "StockBalanceChanged",
              aggregateType: "InventoryStockBalance",
              aggregateId: `${movement.itemId}:${movement.warehouseId}:${movement.locationId ?? "~"}`,
              payload: {
                documentId: document.id,
                documentLineId: movement.lineId,
                ledgerEntryId: ledgerEntry.id,
                itemId: movement.itemId,
                warehouseId: movement.warehouseId,
                locationId: movement.locationId ?? null,
                quantityDelta: movement.delta,
                reservationId: movement.reservationId ?? null,
              } as Prisma.InputJsonValue,
              headers: {
                requestId: ctx.requestId,
                userId: ctx.userId,
              } as Prisma.InputJsonValue,
              idempotencyKey: `${idempotencyKey}:StockBalanceChanged:${ledgerEntry.id}`,
            },
          });

          if (reservationConsumedOnMovement > 0 && movement.reservationId) {
            await tx.inventoryOutboxEvent.create({
              data: {
                companyId: ctx.companyId,
                topic: "ReservationConsumed",
                aggregateType: "InventoryReservation",
                aggregateId: movement.reservationId,
                payload: {
                  documentId: document.id,
                  ledgerEntryId: ledgerEntry.id,
                  consumedQty: reservationConsumedOnMovement,
                  itemId: movement.itemId,
                } as Prisma.InputJsonValue,
                headers: {
                  requestId: ctx.requestId,
                  userId: ctx.userId,
                } as Prisma.InputJsonValue,
                idempotencyKey: `${idempotencyKey}:ReservationConsumed:${ledgerEntry.id}`,
              },
            });
          }

          if (movement.serialNumbers.length > 0) {
            await tx.inventoryOutboxEvent.create({
              data: {
                companyId: ctx.companyId,
                topic: "SerialMoved",
                aggregateType: "InventorySerial",
                aggregateId: movement.itemId,
                payload: {
                  documentId: document.id,
                  documentLineId: movement.lineId,
                  ledgerEntryId: ledgerEntry.id,
                  movementKind: movement.metadata.kind,
                  serialNumbers: movement.serialNumbers,
                } as Prisma.InputJsonValue,
                headers: {
                  requestId: ctx.requestId,
                  userId: ctx.userId,
                } as Prisma.InputJsonValue,
                idempotencyKey: `${idempotencyKey}:SerialMoved:${ledgerEntry.id}`,
              },
            });
          }

          if (movement.batchCode) {
            await tx.inventoryOutboxEvent.create({
              data: {
                companyId: ctx.companyId,
                topic: "BatchMoved",
                aggregateType: "InventoryBatch",
                aggregateId: effectiveBatchId ?? movement.batchCode,
                payload: {
                  documentId: document.id,
                  documentLineId: movement.lineId,
                  ledgerEntryId: ledgerEntry.id,
                  batchCode: movement.batchCode,
                  movementKind: movement.metadata.kind,
                  quantityDelta: movement.delta,
                } as Prisma.InputJsonValue,
                headers: {
                  requestId: ctx.requestId,
                  userId: ctx.userId,
                } as Prisma.InputJsonValue,
                idempotencyKey: `${idempotencyKey}:BatchMoved:${ledgerEntry.id}`,
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

        const response: InventoryDocumentPostResult = {
          documentId: posted.id,
          status: posted.status,
          postedAt: posted.postedAt ? posted.postedAt.toISOString() : null,
          alreadyPosted: false,
          movementCount: movements.length,
          reservationConsumedQty,
        };

        await tx.inventoryOutboxEvent.create({
          data: {
            companyId: ctx.companyId,
            topic: "InventoryDocumentPosted",
            aggregateType: "InventoryDocument",
            aggregateId: document.id,
            payload: {
              documentId: document.id,
              number: document.number,
              documentType: document.documentType,
              postedAt: posted.postedAt?.toISOString() ?? postingTimestamp.toISOString(),
              movementCount: movements.length,
            } as Prisma.InputJsonValue,
            headers: {
              requestId: ctx.requestId,
              userId: ctx.userId,
            } as Prisma.InputJsonValue,
            idempotencyKey: `${idempotencyKey}:InventoryDocumentPosted:${document.id}`,
          },
        });

        await tx.inventoryIdempotencyKey.upsert({
          where: {
            companyId_scope_key: {
              companyId: ctx.companyId,
              scope: idempotencyScope,
              key: idempotencyKey,
            },
          },
          create: {
            companyId: ctx.companyId,
            scope: idempotencyScope,
            key: idempotencyKey,
            requestHash,
            response: response as Prisma.InputJsonValue,
            createdBy: ctx.userId,
          },
          update: {
            requestHash,
            response: response as Prisma.InputJsonValue,
            createdBy: ctx.userId,
          },
        });

        return response;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    ),
  );

  await writeInventoryAudit(ctx, {
    action: "DOCUMENT_POSTED",
    entityType: "InventoryDocument",
    entityId: documentId,
    after: result,
    metadata: {
      reason: options.reason ?? null,
      idempotencyKey,
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

export async function reverseInventoryLedgerEntry(
  ctx: AppContext,
  ledgerEntryId: string,
  options?: { reason?: string | null },
) {
  const result = await withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const source = await tx.inventoryLedgerEntry.findFirst({
          where: {
            id: ledgerEntryId,
            companyId: ctx.companyId,
          },
        });
        if (!source) {
          throw new InventoryError("NOT_FOUND", "Ledger entry not found");
        }

        await lockBalanceRow(
          tx,
          ctx.companyId,
          source.itemId,
          source.warehouseId,
          source.locationId ?? null,
        );

        const existingBalance = await tx.inventoryStockBalance.findFirst({
          where: {
            companyId: ctx.companyId,
            itemId: source.itemId,
            warehouseId: source.warehouseId,
            locationId: source.locationId ?? null,
          },
          select: {
            id: true,
            onHand: true,
            avgCostMinor: true,
            stockValueMinor: true,
            reserved: true,
          },
        });

        const reversalQty = -source.quantityDelta;
        const reversalTotalCost = -(source.totalCostMinor ?? source.quantityDelta * (source.unitCostMinor ?? 0));
        const previousOnHand = existingBalance?.onHand ?? 0;
        const nextOnHand = previousOnHand + reversalQty;
        const previousStockValue = existingBalance?.stockValueMinor ?? previousOnHand * (existingBalance?.avgCostMinor ?? 0);
        const nextStockValue = previousStockValue + reversalTotalCost;
        const nextAvgCost = nextOnHand === 0 ? 0 : Math.round(nextStockValue / nextOnHand);

        const reversal = await tx.inventoryLedgerEntry.create({
          data: {
            companyId: ctx.companyId,
            documentId: source.documentId,
            documentLineId: source.documentLineId,
            itemId: source.itemId,
            warehouseId: source.warehouseId,
            locationId: source.locationId,
            quantityDelta: reversalQty,
            unitCostMinor: source.unitCostMinor,
            totalCostMinor: reversalTotalCost,
            currency: source.currency,
            reservationId: source.reservationId,
            batchCode: source.batchCode,
            serialNumbers: source.serialNumbers as Prisma.InputJsonValue,
            transferGroupId: source.transferGroupId,
            reversalOfLedgerEntryId: source.id,
            metadata: {
              source: "ledger-reversal",
              reason: options?.reason ?? null,
            } as Prisma.InputJsonValue,
            createdBy: ctx.userId,
          },
        });

        if (existingBalance) {
          await tx.inventoryStockBalance.update({
            where: { id: existingBalance.id },
            data: {
              onHand: nextOnHand,
              avgCostMinor: nextAvgCost,
              stockValueMinor: nextStockValue,
            },
          });
        } else {
          await tx.inventoryStockBalance.create({
            data: {
              companyId: ctx.companyId,
              itemId: source.itemId,
              warehouseId: source.warehouseId,
              locationId: source.locationId ?? null,
              onHand: nextOnHand,
              reserved: 0,
              incoming: 0,
              outgoing: 0,
              avgCostMinor: nextAvgCost,
              stockValueMinor: nextStockValue,
            },
          });
        }

        return reversal;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  await writeInventoryAudit(ctx, {
    action: "LEDGER_ENTRY_REVERSED",
    entityType: "InventoryLedgerEntry",
    entityId: result.id,
    metadata: {
      reversalOfLedgerEntryId: ledgerEntryId,
      reason: options?.reason ?? null,
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
      orderBy: [{ postingSeq: "desc" }, { postingTime: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.inventoryLedgerEntry.count({ where }),
  ]);

  const balanceRows = rows.length
    ? await prisma.inventoryStockBalance.findMany({
        where: {
          companyId: ctx.companyId,
          OR: rows.map((row) => ({
            itemId: row.itemId,
            warehouseId: row.warehouseId,
            locationId: row.locationId,
          })),
        },
        select: {
          itemId: true,
          warehouseId: true,
          locationId: true,
          onHand: true,
        },
      })
    : [];

  const balanceCursor = new Map(
    balanceRows.map((row) => [
      `${row.itemId}:${row.warehouseId}:${row.locationId ?? "ROOT"}`,
      row.onHand,
    ]),
  );

  const enrichedRows = rows.map((row) => {
    const key = `${row.itemId}:${row.warehouseId}:${row.locationId ?? "ROOT"}`;
    const balanceQty = balanceCursor.get(key);
    const qtyIn = row.quantityDelta > 0 ? row.quantityDelta : 0;
    const qtyOut = row.quantityDelta < 0 ? Math.abs(row.quantityDelta) : 0;

    if (typeof balanceQty === "number") {
      balanceCursor.set(key, balanceQty - row.quantityDelta);
    }

    return {
      ...row,
      qtyIn,
      qtyOut,
      balanceQty: typeof balanceQty === "number" ? balanceQty : null,
    };
  });

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows: enrichedRows,
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
