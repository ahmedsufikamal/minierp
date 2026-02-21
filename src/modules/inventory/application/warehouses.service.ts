import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { locationSchema, warehouseSchema } from "@/modules/inventory/application/schemas";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";

function mergeWarehouseMetadata(
  existing: unknown,
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null | undefined,
) {
  const base = existing && typeof existing === "object" && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {};
  if (address === undefined) {
    return base;
  }
  if (address === null) {
    delete base.address;
    return base;
  }
  base.address = address;
  return base;
}

async function assertParentWarehouseBelongsToCompany(
  ctx: InventoryRequestContext,
  parentWarehouseId: string,
  selfWarehouseId?: string,
) {
  if (selfWarehouseId && parentWarehouseId === selfWarehouseId) {
    throw new InventoryError("VALIDATION_ERROR", "Warehouse cannot be its own parent");
  }

  const parent = await prisma.inventoryWarehouse.findFirst({
    where: {
      id: parentWarehouseId,
      companyId: ctx.companyId,
    },
    select: {
      id: true,
      parentWarehouseId: true,
    },
  });

  if (!parent) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid parentWarehouseId for this company");
  }

  if (selfWarehouseId && parent.parentWarehouseId === selfWarehouseId) {
    throw new InventoryError("VALIDATION_ERROR", "Parent warehouse cycle detected");
  }
}

export async function listWarehouses(ctx: InventoryRequestContext) {
  return prisma.inventoryWarehouse.findMany({
    where: { companyId: ctx.companyId },
    include: {
      parentWarehouse: {
        select: { id: true, code: true, name: true },
      },
      locations: {
        orderBy: [{ path: "asc" }, { code: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createWarehouse(ctx: InventoryRequestContext, input: unknown) {
  const parsed = warehouseSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid warehouse payload", parsed.error.flatten());
  }

  const existing = await prisma.inventoryWarehouse.findUnique({
    where: {
      companyId_code: {
        companyId: ctx.companyId,
        code: parsed.data.code,
      },
    },
  });

  if (existing) {
    throw new InventoryError("CONFLICT", "Warehouse code already exists");
  }

  if (parsed.data.parentWarehouseId) {
    await assertParentWarehouseBelongsToCompany(ctx, parsed.data.parentWarehouseId);
  }

  const created = await prisma.inventoryWarehouse.create({
    data: {
      companyId: ctx.companyId,
      code: parsed.data.code,
      name: parsed.data.name,
      parentWarehouseId: parsed.data.parentWarehouseId ?? null,
      description: parsed.data.description,
      isActive: parsed.data.isActive,
      metadata: mergeWarehouseMetadata(
        undefined,
        parsed.data.address,
      ) as Prisma.InputJsonValue,
    },
  });

  await writeInventoryAudit(ctx, {
    action: "WAREHOUSE_CREATED",
    entityType: "InventoryWarehouse",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updateWarehouse(ctx: InventoryRequestContext, warehouseId: string, input: unknown) {
  const parsed = warehouseSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid warehouse payload", parsed.error.flatten());
  }

  const existing = await prisma.inventoryWarehouse.findFirst({
    where: { id: warehouseId, companyId: ctx.companyId },
  });
  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Warehouse not found");
  }

  if (parsed.data.parentWarehouseId) {
    await assertParentWarehouseBelongsToCompany(ctx, parsed.data.parentWarehouseId, warehouseId);
  }

  const writeResult = await prisma.inventoryWarehouse.updateMany({
    where: { id: warehouseId, companyId: ctx.companyId },
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      parentWarehouseId: parsed.data.parentWarehouseId,
      description: parsed.data.description,
      isActive: parsed.data.isActive,
      ...(parsed.data.address !== undefined
        ? {
            metadata: mergeWarehouseMetadata(
              existing.metadata,
              parsed.data.address,
            ) as Prisma.InputJsonValue,
          }
        : {}),
    },
  });
  if (writeResult.count === 0) {
    throw new InventoryError("NOT_FOUND", "Warehouse not found");
  }

  const updated = await prisma.inventoryWarehouse.findFirst({
    where: { id: warehouseId, companyId: ctx.companyId },
  });
  if (!updated) {
    throw new InventoryError("NOT_FOUND", "Warehouse not found");
  }

  await writeInventoryAudit(ctx, {
    action: "WAREHOUSE_UPDATED",
    entityType: "InventoryWarehouse",
    entityId: warehouseId,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function createWarehouseLocation(ctx: InventoryRequestContext, input: unknown) {
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid location payload", parsed.error.flatten());
  }

  const warehouse = await prisma.inventoryWarehouse.findFirst({
    where: { id: parsed.data.warehouseId, companyId: ctx.companyId },
  });
  if (!warehouse) {
    throw new InventoryError("NOT_FOUND", "Warehouse not found");
  }

  if (parsed.data.parentId) {
    const parent = await prisma.inventoryWarehouseLocation.findFirst({
      where: {
        id: parsed.data.parentId,
        companyId: ctx.companyId,
        warehouseId: parsed.data.warehouseId,
      },
      select: { id: true },
    });

    if (!parent) {
      throw new InventoryError("VALIDATION_ERROR", "parentId does not belong to this warehouse");
    }
  }

  const created = await prisma.inventoryWarehouseLocation.create({
    data: {
      companyId: ctx.companyId,
      warehouseId: parsed.data.warehouseId,
      parentId: parsed.data.parentId,
      code: parsed.data.code,
      name: parsed.data.name,
      path: parsed.data.path ?? null,
      isActive: parsed.data.isActive,
    },
  });

  await writeInventoryAudit(ctx, {
    action: "LOCATION_CREATED",
    entityType: "InventoryWarehouseLocation",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updateWarehouseLocation(ctx: InventoryRequestContext, locationId: string, input: unknown) {
  const parsed = locationSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid location payload", parsed.error.flatten());
  }

  const existing = await prisma.inventoryWarehouseLocation.findFirst({
    where: { id: locationId, companyId: ctx.companyId },
  });
  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Location not found");
  }

  const writeResult = await prisma.inventoryWarehouseLocation.updateMany({
    where: { id: locationId, companyId: ctx.companyId },
    data: {
      ...parsed.data,
      path: parsed.data.path === undefined ? undefined : parsed.data.path,
    },
  });
  if (writeResult.count === 0) {
    throw new InventoryError("NOT_FOUND", "Location not found");
  }

  const updated = await prisma.inventoryWarehouseLocation.findFirst({
    where: { id: locationId, companyId: ctx.companyId },
  });
  if (!updated) {
    throw new InventoryError("NOT_FOUND", "Location not found");
  }

  await writeInventoryAudit(ctx, {
    action: "LOCATION_UPDATED",
    entityType: "InventoryWarehouseLocation",
    entityId: locationId,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function archiveWarehouse(ctx: InventoryRequestContext, warehouseId: string) {
  const existing = await prisma.inventoryWarehouse.findFirst({
    where: { id: warehouseId, companyId: ctx.companyId },
  });
  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Warehouse not found");
  }

  const writeResult = await prisma.inventoryWarehouse.updateMany({
    where: { id: warehouseId, companyId: ctx.companyId },
    data: { isActive: false },
  });
  if (writeResult.count === 0) {
    throw new InventoryError("NOT_FOUND", "Warehouse not found");
  }

  const updated = await prisma.inventoryWarehouse.findFirst({
    where: { id: warehouseId, companyId: ctx.companyId },
  });
  if (!updated) {
    throw new InventoryError("NOT_FOUND", "Warehouse not found");
  }

  await writeInventoryAudit(ctx, {
    action: "WAREHOUSE_ARCHIVED",
    entityType: "InventoryWarehouse",
    entityId: warehouseId,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function archiveWarehouseLocation(ctx: InventoryRequestContext, locationId: string) {
  const existing = await prisma.inventoryWarehouseLocation.findFirst({
    where: { id: locationId, companyId: ctx.companyId },
  });
  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Location not found");
  }

  const writeResult = await prisma.inventoryWarehouseLocation.updateMany({
    where: { id: locationId, companyId: ctx.companyId },
    data: { isActive: false },
  });
  if (writeResult.count === 0) {
    throw new InventoryError("NOT_FOUND", "Location not found");
  }

  const updated = await prisma.inventoryWarehouseLocation.findFirst({
    where: { id: locationId, companyId: ctx.companyId },
  });
  if (!updated) {
    throw new InventoryError("NOT_FOUND", "Location not found");
  }

  await writeInventoryAudit(ctx, {
    action: "LOCATION_ARCHIVED",
    entityType: "InventoryWarehouseLocation",
    entityId: locationId,
    before: existing,
    after: updated,
  });

  return updated;
}
