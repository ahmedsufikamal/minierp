import { InventoryCustomFieldEntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSku } from "@/domain/inventory/sku";
import { itemListQuerySchema, itemUpsertSchema } from "@/modules/inventory/application/schemas";
import {
  getCustomFieldValuesByEntityIds,
  setEntityCustomFieldValues,
} from "@/modules/inventory/application/custom-fields.service";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";

function pagination(page: number, limit: number) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 200);
  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
  };
}

export async function listInventoryItems(ctx: InventoryRequestContext, input: unknown) {
  const parsed = itemListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid item query", parsed.error.flatten());
  }

  const query = parsed.data;
  const where = {
    companyId: ctx.companyId,
    ...(query.q
      ? {
          OR: [
            { sku: { contains: query.q, mode: "insensitive" as const } },
            { name: { contains: query.q, mode: "insensitive" as const } },
            { description: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const { skip, take } = pagination(query.page, query.limit);

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
        inventoryItemIdentifiers: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);

  const customValues = query.includeCustom
    ? await getCustomFieldValuesByEntityIds(ctx, {
        entityType: InventoryCustomFieldEntityType.ITEM,
        entityIds: rows.map((r) => r.id),
      })
    : {};

  return {
    page: query.page,
    limit: query.limit,
    total,
    rows: rows.map((row) => ({
      ...row,
      customFields: customValues[row.id] ?? {},
    })),
  };
}

export async function getInventoryItemById(ctx: InventoryRequestContext, itemId: string) {
  const item = await prisma.product.findFirst({
    where: { id: itemId, companyId: ctx.companyId },
    include: {
      brand: true,
      category: true,
      subCategory: true,
      inventoryItemIdentifiers: true,
      inventoryStockBalances: {
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          location: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  if (!item) {
    throw new InventoryError("NOT_FOUND", "Item not found");
  }

  const customByEntity = await getCustomFieldValuesByEntityIds(ctx, {
    entityType: InventoryCustomFieldEntityType.ITEM,
    entityIds: [item.id],
  });

  return {
    ...item,
    customFields: customByEntity[item.id] ?? {},
  };
}

async function ensureBrand(ctx: InventoryRequestContext, brandId: string) {
  const brand = await prisma.brand.findFirst({ where: { id: brandId, companyId: ctx.companyId } });
  if (!brand) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid brandId for this company");
  }
}

export async function createInventoryItem(ctx: InventoryRequestContext, input: unknown) {
  const parsed = itemUpsertSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid item payload", parsed.error.flatten());
  }

  const data = parsed.data;
  await ensureBrand(ctx, data.brandId);

  const normalizedSku = normalizeSku(data.sku);

  const conflict = await prisma.product.findUnique({
    where: {
      companyId_brandId_normalizedSku: {
        companyId: ctx.companyId,
        brandId: data.brandId,
        normalizedSku,
      },
    },
    select: { id: true },
  });

  if (conflict) {
    throw new InventoryError("CONFLICT", "SKU already exists for this brand");
  }

  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.product.create({
      data: {
        companyId: ctx.companyId,
        brandId: data.brandId,
        sku: data.sku,
        normalizedSku,
        name: data.name,
        title: data.name,
        description: data.description,
        categoryId: data.categoryId,
        subCategoryId: data.subCategoryId,
        uom: data.uom,
        unitCostMinor: data.unitCostMinor,
        priceCents: data.priceCents,
        trackSerial: data.trackSerial,
        trackBatch: data.trackBatch,
        lowStockThreshold: data.lowStockThreshold,
        isActive: data.isActive,
      },
    });

    if (data.identifiers.length > 0) {
      await tx.inventoryItemIdentifier.createMany({
        data: data.identifiers.map((identifier) => ({
          companyId: ctx.companyId,
          itemId: item.id,
          kind: identifier.kind,
          value: identifier.value,
          isPrimary: identifier.isPrimary,
        })),
      });
    }

    await tx.inventoryItemIdentifier.upsert({
      where: {
        companyId_value: {
          companyId: ctx.companyId,
          value: data.sku,
        },
      },
      create: {
        companyId: ctx.companyId,
        itemId: item.id,
        kind: "SKU",
        value: data.sku,
        isPrimary: true,
      },
      update: {
        itemId: item.id,
        kind: "SKU",
        isPrimary: true,
      },
    });

    return item;
  });

  await setEntityCustomFieldValues(ctx, {
    entityType: InventoryCustomFieldEntityType.ITEM,
    entityId: created.id,
    fields: data.customFields,
  });

  await writeInventoryAudit(ctx, {
    action: "ITEM_CREATED",
    entityType: "Product",
    entityId: created.id,
    after: created,
  });

  return getInventoryItemById(ctx, created.id);
}

export async function updateInventoryItem(ctx: InventoryRequestContext, itemId: string, input: unknown) {
  const parsed = itemUpsertSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid item payload", parsed.error.flatten());
  }

  const existing = await prisma.product.findFirst({ where: { id: itemId, companyId: ctx.companyId } });
  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Item not found");
  }

  const data = parsed.data;

  if (data.brandId) {
    await ensureBrand(ctx, data.brandId);
  }

  const normalizedSku = data.sku ? normalizeSku(data.sku) : undefined;
  if (normalizedSku && (data.brandId || existing.brandId)) {
    const conflict = await prisma.product.findFirst({
      where: {
        id: { not: itemId },
        companyId: ctx.companyId,
        brandId: data.brandId ?? existing.brandId,
        normalizedSku,
      },
      select: { id: true },
    });
    if (conflict) {
      throw new InventoryError("CONFLICT", "SKU already exists for this brand");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.product.update({
      where: { id: itemId },
      data: {
        sku: data.sku,
        normalizedSku,
        name: data.name,
        title: data.name,
        description: data.description,
        brandId: data.brandId,
        categoryId: data.categoryId,
        subCategoryId: data.subCategoryId,
        uom: data.uom,
        unitCostMinor: data.unitCostMinor,
        priceCents: data.priceCents,
        trackSerial: data.trackSerial,
        trackBatch: data.trackBatch,
        lowStockThreshold: data.lowStockThreshold,
        isActive: data.isActive,
      },
    });

    if (data.identifiers) {
      await tx.inventoryItemIdentifier.deleteMany({
        where: {
          companyId: ctx.companyId,
          itemId,
          kind: { not: "SKU" },
        },
      });

      if (data.identifiers.length > 0) {
        await tx.inventoryItemIdentifier.createMany({
          data: data.identifiers.map((identifier) => ({
            companyId: ctx.companyId,
            itemId,
            kind: identifier.kind,
            value: identifier.value,
            isPrimary: identifier.isPrimary,
          })),
        });
      }
    }

    if (data.sku) {
      await tx.inventoryItemIdentifier.upsert({
        where: {
          companyId_value: {
            companyId: ctx.companyId,
            value: data.sku,
          },
        },
        create: {
          companyId: ctx.companyId,
          itemId,
          kind: "SKU",
          value: data.sku,
          isPrimary: true,
        },
        update: {
          itemId,
          kind: "SKU",
          isPrimary: true,
        },
      });
    }

    return record;
  });

  if (data.customFields) {
    await setEntityCustomFieldValues(ctx, {
      entityType: InventoryCustomFieldEntityType.ITEM,
      entityId: itemId,
      fields: data.customFields,
    });
  }

  await writeInventoryAudit(ctx, {
    action: "ITEM_UPDATED",
    entityType: "Product",
    entityId: itemId,
    before: existing,
    after: updated,
  });

  return getInventoryItemById(ctx, itemId);
}

export async function archiveInventoryItem(ctx: InventoryRequestContext, itemId: string) {
  const existing = await prisma.product.findFirst({ where: { id: itemId, companyId: ctx.companyId } });
  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Item not found");
  }

  const updated = await prisma.product.update({
    where: { id: itemId },
    data: { isActive: false },
  });

  await writeInventoryAudit(ctx, {
    action: "ITEM_ARCHIVED",
    entityType: "Product",
    entityId: itemId,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function searchItemBySkuOrIdentifier(ctx: InventoryRequestContext, code: string) {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new InventoryError("VALIDATION_ERROR", "code is required");
  }

  const bySku = await prisma.product.findFirst({
    where: {
      companyId: ctx.companyId,
      OR: [{ sku: trimmed }, { normalizedSku: normalizeSku(trimmed) }],
    },
    include: {
      brand: true,
      inventoryItemIdentifiers: true,
    },
  });

  if (bySku) return bySku;

  const identifier = await prisma.inventoryItemIdentifier.findFirst({
    where: { companyId: ctx.companyId, value: trimmed },
    include: {
      item: {
        include: {
          brand: true,
          inventoryItemIdentifiers: true,
        },
      },
    },
  });

  if (!identifier?.item) {
    throw new InventoryError("NOT_FOUND", "Item not found for provided code");
  }

  return identifier.item;
}

export async function listInventoryReferenceData(ctx: InventoryRequestContext) {
  const [brands, categories, subCategories, warehouses] = await Promise.all([
    prisma.brand.findMany({ where: { companyId: ctx.companyId }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ where: { companyId: ctx.companyId }, orderBy: { name: "asc" } }),
    prisma.subCategory.findMany({ where: { companyId: ctx.companyId }, orderBy: { name: "asc" } }),
    prisma.inventoryWarehouse.findMany({ where: { companyId: ctx.companyId, isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return { brands, categories, subCategories, warehouses };
}
