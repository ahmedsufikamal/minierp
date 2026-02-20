import { prisma } from "@/lib/prisma";
import { inventoryCompanySettingsSchema } from "@/modules/inventory/application/schemas";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";

type InventoryCompanySettingsView = {
  valuationMethod: "MOVING_AVERAGE" | "FIFO";
  preventNegativeStock: boolean;
  allowNegativeOverride: boolean;
  trackByLocation: boolean;
  baseCurrency: string;
};

function mapCostingMethodToValuation(method: string | null | undefined): "MOVING_AVERAGE" | "FIFO" {
  if (method === "FIFO") return "FIFO";
  return "MOVING_AVERAGE";
}

function mapValuationToCostingMethod(method: "MOVING_AVERAGE" | "FIFO"): string {
  if (method === "FIFO") return "FIFO";
  return "AVG";
}

function toViewModel(input: {
  costingMethod: string;
  preventNegativeStock: boolean;
  allowNegativeOverride: boolean;
  trackByLocation: boolean;
  baseCurrency: string;
}): InventoryCompanySettingsView {
  return {
    valuationMethod: mapCostingMethodToValuation(input.costingMethod),
    preventNegativeStock: input.preventNegativeStock,
    allowNegativeOverride: input.allowNegativeOverride,
    trackByLocation: input.trackByLocation,
    baseCurrency: input.baseCurrency,
  };
}

export async function getInventoryCompanySettings(ctx: InventoryRequestContext): Promise<InventoryCompanySettingsView> {
  const settings = await prisma.inventoryCompanySetting.findUnique({
    where: { companyId: ctx.companyId },
    select: {
      costingMethod: true,
      preventNegativeStock: true,
      allowNegativeOverride: true,
      trackByLocation: true,
      baseCurrency: true,
    },
  });

  if (!settings) {
    const created = await prisma.inventoryCompanySetting.create({
      data: {
        companyId: ctx.companyId,
        costingMethod: "AVG",
        preventNegativeStock: true,
        allowNegativeOverride: false,
        trackByLocation: false,
        baseCurrency: "BDT",
      },
      select: {
        costingMethod: true,
        preventNegativeStock: true,
        allowNegativeOverride: true,
        trackByLocation: true,
        baseCurrency: true,
      },
    });
    return toViewModel(created);
  }

  return toViewModel(settings);
}

export async function updateInventoryCompanySettings(
  ctx: InventoryRequestContext,
  input: unknown,
): Promise<InventoryCompanySettingsView> {
  const parsed = inventoryCompanySettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid inventory settings payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  const previous = await prisma.inventoryCompanySetting.findUnique({
    where: { companyId: ctx.companyId },
    select: {
      id: true,
      costingMethod: true,
      preventNegativeStock: true,
      allowNegativeOverride: true,
      trackByLocation: true,
      baseCurrency: true,
    },
  });

  const updated = await prisma.inventoryCompanySetting.upsert({
    where: { companyId: ctx.companyId },
    create: {
      companyId: ctx.companyId,
      costingMethod: mapValuationToCostingMethod(payload.valuationMethod),
      preventNegativeStock: payload.preventNegativeStock,
      allowNegativeOverride: payload.allowNegativeOverride,
      trackByLocation: payload.trackByLocation,
      baseCurrency: payload.baseCurrency.toUpperCase(),
    },
    update: {
      costingMethod: mapValuationToCostingMethod(payload.valuationMethod),
      preventNegativeStock: payload.preventNegativeStock,
      allowNegativeOverride: payload.allowNegativeOverride,
      trackByLocation: payload.trackByLocation,
      baseCurrency: payload.baseCurrency.toUpperCase(),
    },
    select: {
      costingMethod: true,
      preventNegativeStock: true,
      allowNegativeOverride: true,
      trackByLocation: true,
      baseCurrency: true,
    },
  });

  await writeInventoryAudit(ctx, {
    action: "INVENTORY_SETTINGS_UPDATED",
    entityType: "InventoryCompanySetting",
    entityId: previous?.id ?? ctx.companyId,
    before: previous,
    after: updated,
  });

  return toViewModel(updated);
}
