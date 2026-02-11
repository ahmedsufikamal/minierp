import { prisma } from "@/lib/prisma";
import { reorderRuleSchema } from "@/modules/inventory/application/schemas";
import { calculateReorderSuggestion } from "@/modules/inventory/domain/reorder";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";

export async function listReorderRules(ctx: InventoryRequestContext) {
  return prisma.inventoryReorderRule.findMany({
    where: { companyId: ctx.companyId },
    include: {
      item: { select: { id: true, sku: true, name: true, uom: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      location: { select: { id: true, code: true, name: true } },
      preferredVendor: { select: { id: true, name: true } },
    },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createReorderRule(ctx: InventoryRequestContext, input: unknown) {
  const parsed = reorderRuleSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid reorder rule payload", parsed.error.flatten());
  }

  const existing = await prisma.inventoryReorderRule.findUnique({
    where: {
      companyId_itemId_warehouseId_locationId: {
        companyId: ctx.companyId,
        itemId: parsed.data.itemId,
        warehouseId: parsed.data.warehouseId,
        locationId: parsed.data.locationId,
      },
    },
  });

  if (existing) {
    throw new InventoryError("CONFLICT", "A reorder rule already exists for this item/warehouse/location");
  }

  const created = await prisma.inventoryReorderRule.create({
    data: {
      companyId: ctx.companyId,
      ...parsed.data,
      createdBy: ctx.userId,
    },
  });

  await writeInventoryAudit(ctx, {
    action: "REORDER_RULE_CREATED",
    entityType: "InventoryReorderRule",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updateReorderRule(ctx: InventoryRequestContext, ruleId: string, input: unknown) {
  const parsed = reorderRuleSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid reorder rule payload", parsed.error.flatten());
  }

  const existing = await prisma.inventoryReorderRule.findFirst({
    where: { id: ruleId, companyId: ctx.companyId },
  });

  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Reorder rule not found");
  }

  const updated = await prisma.inventoryReorderRule.update({
    where: { id: ruleId },
    data: parsed.data,
  });

  await writeInventoryAudit(ctx, {
    action: "REORDER_RULE_UPDATED",
    entityType: "InventoryReorderRule",
    entityId: updated.id,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function deleteReorderRule(ctx: InventoryRequestContext, ruleId: string) {
  const existing = await prisma.inventoryReorderRule.findFirst({
    where: { id: ruleId, companyId: ctx.companyId },
  });

  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Reorder rule not found");
  }

  await prisma.inventoryReorderRule.delete({ where: { id: ruleId } });

  await writeInventoryAudit(ctx, {
    action: "REORDER_RULE_DELETED",
    entityType: "InventoryReorderRule",
    entityId: ruleId,
    before: existing,
  });
}

export async function getReorderSuggestions(ctx: InventoryRequestContext) {
  const rules = await prisma.inventoryReorderRule.findMany({
    where: { companyId: ctx.companyId, isActive: true },
    include: {
      item: { select: { id: true, sku: true, name: true, uom: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      location: { select: { id: true, code: true, name: true } },
      preferredVendor: { select: { id: true, name: true } },
    },
  });

  const suggestions = [] as Array<{
    ruleId: string;
    itemId: string;
    itemName: string;
    sku: string;
    warehouseId: string;
    warehouseName: string;
    availableQty: number;
    reorderPoint: number;
    suggestedQty: number;
    leadTimeDays: number;
    preferredVendor: { id: string; name: string } | null;
  }>;

  for (const rule of rules) {
    const balance = await prisma.inventoryStockBalance.findUnique({
      where: {
        companyId_itemId_warehouseId_locationId: {
          companyId: ctx.companyId,
          itemId: rule.itemId,
          warehouseId: rule.warehouseId,
          locationId: rule.locationId,
        },
      },
      select: { onHand: true, reserved: true, incoming: true, outgoing: true },
    });

    const suggestion = calculateReorderSuggestion({
      onHand: balance?.onHand ?? 0,
      reserved: balance?.reserved ?? 0,
      incoming: balance?.incoming ?? 0,
      outgoing: balance?.outgoing ?? 0,
      reorderPoint: rule.reorderPoint,
      reorderQty: rule.reorderQty,
      maxQty: rule.maxQty,
    });

    if (suggestion.shouldReorder) {
      const available = suggestion.availableQty;
      const suggestedQty = suggestion.suggestedQty;

      suggestions.push({
        ruleId: rule.id,
        itemId: rule.item.id,
        itemName: rule.item.name,
        sku: rule.item.sku,
        warehouseId: rule.warehouse.id,
        warehouseName: rule.warehouse.name,
        availableQty: available,
        reorderPoint: rule.reorderPoint,
        suggestedQty,
        leadTimeDays: rule.leadTimeDays,
        preferredVendor: rule.preferredVendor
          ? { id: rule.preferredVendor.id, name: rule.preferredVendor.name }
          : null,
      });

      await prisma.inventoryNotification.create({
        data: {
          companyId: ctx.companyId,
          type: "LOW_STOCK",
          title: `Reorder suggested for ${rule.item.sku}`,
          message: `${rule.item.name} available ${available} <= reorder point ${rule.reorderPoint}`,
          payload: {
            ruleId: rule.id,
            itemId: rule.itemId,
            warehouseId: rule.warehouseId,
            suggestedQty,
          },
        },
      });
    }
  }

  return suggestions;
}
