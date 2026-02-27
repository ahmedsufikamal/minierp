import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  reconciliationApplySchema,
  reconciliationPreviewSchema,
} from "@/modules/inventory/application/schemas";
import {
  applyInventoryDocumentAction,
  createInventoryDocument,
} from "@/modules/inventory/application/documents.service";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";
import {
  advisoryLockInventoryScopeInTx,
  withSerializableRetry,
} from "@/modules/inventory/infrastructure/tx";

function buildReconciliationNumber(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `REC-${stamp}-${suffix}`;
}

function normalizeSerialNumbers(serials: string[] | undefined): string[] {
  if (!serials || serials.length === 0) return [];
  return [...new Set(serials.map((value) => value.trim()).filter(Boolean))];
}

type ReconciliationLineResult = {
  itemId: string;
  itemName: string;
  sku: string;
  currentQty: number;
  countedQty: number;
  deltaQty: number;
  unitCostMinor: number;
  valueDeltaMinor: number;
  batchCode: string | null;
  serialNumbers: string[];
};

async function buildReconciliationPreviewResult(
  ctx: InventoryRequestContext,
  input: {
    warehouseId: string;
    locationId: string | null;
    lines: Array<{
      itemId: string;
      countedQty: number;
      unitCostMinor?: number | null;
      batchCode?: string | null;
      serialNumbers?: string[];
    }>;
  },
): Promise<{
  warehouseId: string;
  locationId: string | null;
  totals: {
    lineCount: number;
    increaseQty: number;
    decreaseQty: number;
    netDeltaQty: number;
    netValueDeltaMinor: number;
  };
  lines: ReconciliationLineResult[];
}> {
  const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
  const [items, balances] = await Promise.all([
    prisma.product.findMany({
      where: {
        companyId: ctx.companyId,
        id: { in: itemIds },
      },
      select: {
        id: true,
        sku: true,
        name: true,
        unitCostMinor: true,
      },
    }),
    prisma.inventoryStockBalance.findMany({
      where: {
        companyId: ctx.companyId,
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        itemId: { in: itemIds },
      },
      select: {
        itemId: true,
        onHand: true,
        avgCostMinor: true,
      },
    }),
  ]);

  if (items.length !== itemIds.length) {
    throw new InventoryError("VALIDATION_ERROR", "One or more reconciliation items are invalid");
  }

  const itemById = new Map(items.map((item) => [item.id, item]));
  const balanceByItemId = new Map(balances.map((balance) => [balance.itemId, balance]));

  const lines: ReconciliationLineResult[] = input.lines.map((line) => {
    const item = itemById.get(line.itemId);
    if (!item) {
      throw new InventoryError("VALIDATION_ERROR", `Invalid reconciliation item '${line.itemId}'`);
    }

    const current = balanceByItemId.get(line.itemId);
    const currentQty = current?.onHand ?? 0;
    const deltaQty = line.countedQty - currentQty;
    const unitCostMinor =
      line.unitCostMinor ??
      current?.avgCostMinor ??
      item.unitCostMinor ??
      0;

    return {
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      currentQty,
      countedQty: line.countedQty,
      deltaQty,
      unitCostMinor,
      valueDeltaMinor: deltaQty * unitCostMinor,
      batchCode: line.batchCode ?? null,
      serialNumbers: normalizeSerialNumbers(line.serialNumbers),
    };
  });

  const totals = lines.reduce(
    (acc, line) => {
      if (line.deltaQty > 0) acc.increaseQty += line.deltaQty;
      if (line.deltaQty < 0) acc.decreaseQty += Math.abs(line.deltaQty);
      acc.netDeltaQty += line.deltaQty;
      acc.netValueDeltaMinor += line.valueDeltaMinor;
      return acc;
    },
    {
      lineCount: lines.length,
      increaseQty: 0,
      decreaseQty: 0,
      netDeltaQty: 0,
      netValueDeltaMinor: 0,
    },
  );

  return {
    warehouseId: input.warehouseId,
    locationId: input.locationId,
    totals,
    lines,
  };
}

export async function previewInventoryReconciliation(
  ctx: InventoryRequestContext,
  input: unknown,
) {
  const parsed = reconciliationPreviewSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError(
      "VALIDATION_ERROR",
      "Invalid reconciliation preview payload",
      parsed.error.flatten(),
    );
  }

  return buildReconciliationPreviewResult(ctx, {
    warehouseId: parsed.data.warehouseId,
    locationId: parsed.data.locationId ?? null,
    lines: parsed.data.lines,
  });
}

export async function applyInventoryReconciliation(
  ctx: InventoryRequestContext,
  input: unknown,
  options?: { idempotencyKey?: string },
) {
  const parsed = reconciliationApplySchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError(
      "VALIDATION_ERROR",
      "Invalid reconciliation payload",
      parsed.error.flatten(),
    );
  }

  const idempotencyKey = options?.idempotencyKey?.trim();
  if (!idempotencyKey) {
    throw new InventoryError("VALIDATION_ERROR", "Idempotency key is required for reconciliation apply");
  }

  const payload = parsed.data;
  await withSerializableRetry(async () =>
    prisma.$transaction(
      async (tx) => {
        const uniqueItemIds = [...new Set(payload.lines.map((line) => line.itemId))];
        for (const itemId of uniqueItemIds) {
          await advisoryLockInventoryScopeInTx(tx, {
            companyId: ctx.companyId,
            itemId,
            warehouseId: payload.warehouseId,
            locationId: payload.locationId ?? null,
          });
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    ),
  );

  const preview = await buildReconciliationPreviewResult(ctx, {
    warehouseId: payload.warehouseId,
    locationId: payload.locationId ?? null,
    lines: payload.lines,
  });

  const number = payload.number ?? buildReconciliationNumber();

  const balanceBefore = await prisma.inventoryStockBalance.findMany({
    where: {
      companyId: ctx.companyId,
      warehouseId: payload.warehouseId,
      locationId: payload.locationId ?? null,
      itemId: { in: [...new Set(payload.lines.map((line) => line.itemId))] },
    },
    select: {
      itemId: true,
      onHand: true,
      reserved: true,
      avgCostMinor: true,
      stockValueMinor: true,
    },
  });

  const document = await createInventoryDocument(ctx, {
    documentType: "COUNT",
    number,
    documentDate: payload.documentDate,
    externalRef: payload.externalRef,
    notes: payload.notes,
    sourceWarehouseId: payload.warehouseId,
    sourceLocationId: payload.locationId,
    lines: payload.lines.map((line) => ({
      itemId: line.itemId,
      quantity: line.countedQty,
      unitCostMinor: line.unitCostMinor,
      currency: line.currency,
      sourceWarehouseId: payload.warehouseId,
      sourceLocationId: payload.locationId,
      batchCode: line.batchCode,
      serialNumbers: line.serialNumbers,
      customData: {
        reconciliation: true,
      },
    })),
  });

  await applyInventoryDocumentAction(ctx, document.id, {
    action: "SUBMIT",
    reason: payload.reason ?? "Reconciliation submission",
  });
  await applyInventoryDocumentAction(ctx, document.id, {
    action: "APPROVE",
    reason: payload.reason ?? "Reconciliation approval",
  });
  const posted = await applyInventoryDocumentAction(ctx, document.id, {
    action: "POST",
    reason: payload.reason ?? "Stock reconciliation posting",
    idempotencyKey,
  });

  const balanceAfter = await prisma.inventoryStockBalance.findMany({
    where: {
      companyId: ctx.companyId,
      warehouseId: payload.warehouseId,
      locationId: payload.locationId ?? null,
      itemId: { in: [...new Set(payload.lines.map((line) => line.itemId))] },
    },
    select: {
      itemId: true,
      onHand: true,
      reserved: true,
      avgCostMinor: true,
      stockValueMinor: true,
    },
  });

  await writeInventoryAudit(ctx, {
    action: "RECONCILIATION_APPLIED",
    entityType: "InventoryDocument",
    entityId: document.id,
    before: {
      previewTotals: preview.totals,
      balances: balanceBefore,
    },
    after: posted,
    metadata: {
      warehouseId: payload.warehouseId,
      locationId: payload.locationId ?? null,
      totals: preview.totals,
      idempotencyKey,
      balanceAfter,
    },
  });

  return {
    documentId: document.id,
    number,
    idempotencyKey,
    posted,
    preview,
  };
}
