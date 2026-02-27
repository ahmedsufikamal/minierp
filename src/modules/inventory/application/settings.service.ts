import { prisma } from "@/lib/prisma";
import { inventoryCompanySettingsSchema } from "@/modules/inventory/application/schemas";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";

type InventoryCompanySettingsView = {
  defaultWarehouseId: string | null;
  documentSeriesCode: string | null;
  defaultUom: string;
  valuationMethod: "MOVING_AVERAGE" | "FIFO" | "STANDARD";
  preventNegativeStock: boolean;
  allowNegativeOverride: boolean;
  trackByLocation: boolean;
  baseCurrency: string;
};

function isSettingsSchemaMismatchError(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  const message = e?.message ?? "";
  return (
    e?.code === "P2021" ||
    e?.code === "P2022" ||
    (message.includes("Unknown field") && message.includes("InventoryCompanySetting")) ||
    message.includes("Unknown argument `defaultWarehouseId`") ||
    message.includes("Unknown argument `documentSeriesCode`") ||
    message.includes("Unknown argument `defaultUom`") ||
    message.includes("Unknown argument `costingMethod`") ||
    message.includes("Unknown argument `preventNegativeStock`") ||
    message.includes("Unknown argument `allowNegativeOverride`") ||
    message.includes("Unknown argument `trackByLocation`") ||
    message.includes("Unknown argument `baseCurrency`")
  );
}

async function withSettingsSchemaGuard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isSettingsSchemaMismatchError(error)) {
      throw new InventoryError(
        "CONFLICT",
        "Inventory settings schema is out of date. Run Prisma migrations and regenerate Prisma client.",
      );
    }
    throw error;
  }
}

function mapCostingMethodToValuation(method: string | null | undefined): "MOVING_AVERAGE" | "FIFO" | "STANDARD" {
  if (method === "FIFO") return "FIFO";
  if (method === "STANDARD") return "STANDARD";
  return "MOVING_AVERAGE";
}

function mapValuationToCostingMethod(method: "MOVING_AVERAGE" | "FIFO" | "STANDARD"): string {
  if (method === "FIFO") return "FIFO";
  if (method === "STANDARD") return "STANDARD";
  return "AVG";
}

function toViewModel(input: {
  defaultWarehouseId: string | null;
  documentSeriesCode: string | null;
  defaultUom: string;
  costingMethod: string;
  preventNegativeStock: boolean;
  allowNegativeOverride: boolean;
  trackByLocation: boolean;
  baseCurrency: string;
}): InventoryCompanySettingsView {
  return {
    defaultWarehouseId: input.defaultWarehouseId,
    documentSeriesCode: input.documentSeriesCode ?? null,
    defaultUom: input.defaultUom || "pcs",
    valuationMethod: mapCostingMethodToValuation(input.costingMethod),
    preventNegativeStock: input.preventNegativeStock,
    allowNegativeOverride: input.allowNegativeOverride,
    trackByLocation: input.trackByLocation,
    baseCurrency: input.baseCurrency,
  };
}

export async function getInventoryCompanySettings(ctx: InventoryRequestContext): Promise<InventoryCompanySettingsView> {
  const settings = await withSettingsSchemaGuard(() =>
    prisma.inventoryCompanySetting.findUnique({
      where: { companyId: ctx.companyId },
      select: {
        defaultWarehouseId: true,
        documentSeriesCode: true,
        defaultUom: true,
        costingMethod: true,
        preventNegativeStock: true,
        allowNegativeOverride: true,
        trackByLocation: true,
        baseCurrency: true,
      },
    }),
  );

  if (!settings) {
    const created = await withSettingsSchemaGuard(() =>
      prisma.inventoryCompanySetting.create({
        data: {
          companyId: ctx.companyId,
          defaultWarehouseId: null,
          documentSeriesCode: "INV-DOC",
          defaultUom: "pcs",
          costingMethod: "AVG",
          preventNegativeStock: true,
          allowNegativeOverride: false,
          trackByLocation: false,
          baseCurrency: "BDT",
        },
        select: {
          defaultWarehouseId: true,
          documentSeriesCode: true,
          defaultUom: true,
          costingMethod: true,
          preventNegativeStock: true,
          allowNegativeOverride: true,
          trackByLocation: true,
          baseCurrency: true,
        },
      }),
    );
    return toViewModel(created);
  }

  return toViewModel(settings);
}

export async function updateInventoryCompanySettings(
  ctx: InventoryRequestContext,
  input: unknown,
): Promise<InventoryCompanySettingsView> {
  const parsed = inventoryCompanySettingsSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid inventory settings payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  const previous = await withSettingsSchemaGuard(() =>
    prisma.inventoryCompanySetting.findUnique({
      where: { companyId: ctx.companyId },
      select: {
        id: true,
        defaultWarehouseId: true,
        documentSeriesCode: true,
        defaultUom: true,
        costingMethod: true,
        preventNegativeStock: true,
        allowNegativeOverride: true,
        trackByLocation: true,
        baseCurrency: true,
      },
    }),
  );

  const current = previous ?? {
    id: ctx.companyId,
    defaultWarehouseId: null,
    documentSeriesCode: "INV-DOC",
    defaultUom: "pcs",
    costingMethod: "AVG",
    preventNegativeStock: true,
    allowNegativeOverride: false,
    trackByLocation: false,
    baseCurrency: "BDT",
  };

  const next = {
    defaultWarehouseId: payload.defaultWarehouseId ?? current.defaultWarehouseId ?? null,
    documentSeriesCode: payload.documentSeriesCode ?? current.documentSeriesCode ?? "INV-DOC",
    defaultUom: payload.defaultUom ?? current.defaultUom ?? "pcs",
    valuationMethod: payload.valuationMethod ?? mapCostingMethodToValuation(current.costingMethod),
    preventNegativeStock: payload.preventNegativeStock ?? current.preventNegativeStock,
    allowNegativeOverride: payload.allowNegativeOverride ?? current.allowNegativeOverride,
    trackByLocation: payload.trackByLocation ?? current.trackByLocation,
    baseCurrency: (payload.baseCurrency ?? current.baseCurrency).toUpperCase(),
  } as const;

  if (next.defaultWarehouseId) {
    const warehouse = await prisma.inventoryWarehouse.findFirst({
      where: {
        id: next.defaultWarehouseId,
        companyId: ctx.companyId,
      },
      select: { id: true },
    });
    if (!warehouse) {
      throw new InventoryError("VALIDATION_ERROR", "Invalid defaultWarehouseId for this company");
    }
  }

  const updated = await withSettingsSchemaGuard(() =>
    prisma.inventoryCompanySetting.upsert({
      where: { companyId: ctx.companyId },
      create: {
        companyId: ctx.companyId,
        defaultWarehouseId: next.defaultWarehouseId,
        documentSeriesCode: next.documentSeriesCode,
        defaultUom: next.defaultUom,
        costingMethod: mapValuationToCostingMethod(next.valuationMethod),
        preventNegativeStock: next.preventNegativeStock,
        allowNegativeOverride: next.allowNegativeOverride,
        trackByLocation: next.trackByLocation,
        baseCurrency: next.baseCurrency,
      },
      update: {
        defaultWarehouseId: next.defaultWarehouseId,
        documentSeriesCode: next.documentSeriesCode,
        defaultUom: next.defaultUom,
        costingMethod: mapValuationToCostingMethod(next.valuationMethod),
        preventNegativeStock: next.preventNegativeStock,
        allowNegativeOverride: next.allowNegativeOverride,
        trackByLocation: next.trackByLocation,
        baseCurrency: next.baseCurrency,
      },
      select: {
        defaultWarehouseId: true,
        documentSeriesCode: true,
        defaultUom: true,
        costingMethod: true,
        preventNegativeStock: true,
        allowNegativeOverride: true,
        trackByLocation: true,
        baseCurrency: true,
      },
    }),
  );

  await writeInventoryAudit(ctx, {
    action: "INVENTORY_SETTINGS_UPDATED",
    entityType: "InventoryCompanySetting",
    entityId: previous?.id ?? ctx.companyId,
    before: previous,
    after: updated,
  });

  return toViewModel(updated);
}
