import { InventoryPresetScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { viewPresetSchema } from "@/modules/inventory/application/schemas";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";

export async function listViewPresets(ctx: InventoryRequestContext, entity?: string) {
  return prisma.inventoryViewPreset.findMany({
    where: {
      companyId: ctx.companyId,
      ...(entity ? { entity } : {}),
      OR: [
        { scope: InventoryPresetScope.COMPANY },
        { scope: InventoryPresetScope.ROLE, role: ctx.role },
        { scope: InventoryPresetScope.USER, ownerUserId: ctx.userId },
      ],
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createViewPreset(ctx: InventoryRequestContext, input: unknown) {
  const parsed = viewPresetSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid view preset payload", parsed.error.flatten());
  }

  const data = parsed.data;
  const ownerUserId = data.scope === InventoryPresetScope.USER ? ctx.userId : null;

  const created = await prisma.inventoryViewPreset.create({
    data: {
      companyId: ctx.companyId,
      entity: data.entity,
      name: data.name,
      scope: data.scope,
      ownerUserId,
      role: data.scope === InventoryPresetScope.ROLE ? data.role : null,
      isDefault: data.isDefault,
      config: data.config,
    },
  });

  await writeInventoryAudit(ctx, {
    action: "VIEW_PRESET_CREATED",
    entityType: "InventoryViewPreset",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updateViewPreset(ctx: InventoryRequestContext, id: string, input: unknown) {
  const parsed = viewPresetSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid view preset payload", parsed.error.flatten());
  }

  const existing = await prisma.inventoryViewPreset.findFirst({
    where: {
      id,
      companyId: ctx.companyId,
      OR: [
        { scope: InventoryPresetScope.COMPANY },
        { scope: InventoryPresetScope.ROLE, role: ctx.role },
        { scope: InventoryPresetScope.USER, ownerUserId: ctx.userId },
      ],
    },
  });

  if (!existing) {
    throw new InventoryError("NOT_FOUND", "View preset not found");
  }

  const updated = await prisma.inventoryViewPreset.update({
    where: { id },
    data: {
      ...parsed.data,
      config: parsed.data.config,
      role: parsed.data.scope === InventoryPresetScope.ROLE ? parsed.data.role : parsed.data.role ?? existing.role,
      ownerUserId:
        parsed.data.scope === InventoryPresetScope.USER
          ? ctx.userId
          : parsed.data.scope
            ? null
            : existing.ownerUserId,
    },
  });

  await writeInventoryAudit(ctx, {
    action: "VIEW_PRESET_UPDATED",
    entityType: "InventoryViewPreset",
    entityId: id,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function deleteViewPreset(ctx: InventoryRequestContext, id: string) {
  const existing = await prisma.inventoryViewPreset.findFirst({
    where: {
      id,
      companyId: ctx.companyId,
      OR: [
        { scope: InventoryPresetScope.COMPANY },
        { scope: InventoryPresetScope.ROLE, role: ctx.role },
        { scope: InventoryPresetScope.USER, ownerUserId: ctx.userId },
      ],
    },
  });

  if (!existing) {
    throw new InventoryError("NOT_FOUND", "View preset not found");
  }

  await prisma.inventoryViewPreset.delete({ where: { id } });

  await writeInventoryAudit(ctx, {
    action: "VIEW_PRESET_DELETED",
    entityType: "InventoryViewPreset",
    entityId: id,
    before: existing,
  });
}
