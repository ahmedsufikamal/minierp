import { prisma } from "@/lib/prisma";
import { normalizeSku } from "@/domain/inventory/sku";
import { appendAuditEvent } from "@/modules/platform/application/audit-ledger.service";
import { allocateCompanyRequiredSeriesNumber } from "@/modules/platform/application/company-numbering.service";
import {
  enforcePublishedWorkflowTransition,
  seedCoreMetaModels,
  validateCustomDataAgainstPublishedMetadata,
} from "@/modules/platform/application/meta-model.service";
import {
  masterItemUpsertSchema,
  masterItemsQuerySchema,
} from "@/modules/platform/domain/meta-master-schemas";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

function decodeCursor(cursor: string | undefined): { id: string } | undefined {
  if (!cursor) return undefined;
  return { id: cursor };
}

function buildItemSearchWhere(companyId: string, query?: string) {
  if (!query?.trim()) {
    return { companyId };
  }

  const q = query.trim();
  return {
    companyId,
    OR: [
      { sku: { contains: q, mode: "insensitive" as const } },
      { name: { contains: q, mode: "insensitive" as const } },
      { barcode: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

async function assertBrandForCompany(ctx: PlatformRequestContext, brandId: string): Promise<void> {
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, companyId: ctx.companyId },
    select: { id: true },
  });

  if (!brand) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid brandId for this company");
  }
}

async function assertOptionalLookupIds(
  ctx: PlatformRequestContext,
  input: {
    categoryId?: string | null;
    subCategoryId?: string | null;
    itemGroupId?: string | null;
    uomId?: string | null;
  },
): Promise<void> {
  if (input.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!category) throw new PlatformError("VALIDATION_ERROR", "Invalid categoryId for this company");
  }

  if (input.subCategoryId) {
    const subCategory = await prisma.subCategory.findFirst({
      where: { id: input.subCategoryId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!subCategory) throw new PlatformError("VALIDATION_ERROR", "Invalid subCategoryId for this company");
  }

  if (input.itemGroupId) {
    const itemGroup = await prisma.setupItemGroup.findFirst({
      where: {
        id: input.itemGroupId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
      select: { id: true },
    });
    if (!itemGroup) throw new PlatformError("VALIDATION_ERROR", "Invalid itemGroupId for this company");
  }

  if (input.uomId) {
    const uom = await prisma.setupUom.findFirst({
      where: {
        id: input.uomId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
      select: { id: true },
    });
    if (!uom) throw new PlatformError("VALIDATION_ERROR", "Invalid uomId for this company");
  }
}

async function ensureSkuAvailable(input: {
  companyId: string;
  brandId: string;
  sku: string;
  itemIdToIgnore?: string;
}): Promise<void> {
  const normalizedSku = normalizeSku(input.sku);
  const existing = await prisma.product.findFirst({
    where: {
      companyId: input.companyId,
      brandId: input.brandId,
      normalizedSku,
      ...(input.itemIdToIgnore ? { id: { not: input.itemIdToIgnore } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new PlatformError("CONFLICT", "SKU already exists for this brand");
  }
}

async function loadItemOrThrow(ctx: PlatformRequestContext, id: string) {
  const row = await prisma.product.findFirst({
    where: {
      id,
      companyId: ctx.companyId,
    },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      subCategory: { select: { id: true, name: true } },
      itemGroup: { select: { id: true, name: true } },
      uomRef: { select: { id: true, name: true, symbol: true } },
    },
  });

  if (!row) {
    throw new PlatformError("NOT_FOUND", "Item not found");
  }

  return row;
}

export async function listMasterItems(ctx: PlatformRequestContext, input: unknown) {
  await seedCoreMetaModels(ctx);
  const parsed = masterItemsQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid item query", parsed.error.flatten());
  }

  const query = parsed.data;
  const where = buildItemSearchWhere(ctx.companyId, query.query);
  const cursor = decodeCursor(query.cursor);

  const rows = await prisma.product.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor, skip: 1 } : {}),
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      subCategory: { select: { id: true, name: true } },
      itemGroup: { select: { id: true, name: true } },
      uomRef: { select: { id: true, name: true, symbol: true } },
    },
  });

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null;

  return {
    rows: pageRows,
    limit: query.limit,
    cursor: nextCursor,
  };
}

export async function createMasterItem(ctx: PlatformRequestContext, input: unknown) {
  await seedCoreMetaModels(ctx);
  const parsed = masterItemUpsertSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid item payload", parsed.error.flatten());
  }

  const data = parsed.data;

  await assertBrandForCompany(ctx, data.brandId);
  await assertOptionalLookupIds(ctx, {
    categoryId: data.categoryId,
    subCategoryId: data.subCategoryId,
    itemGroupId: data.itemGroupId,
    uomId: data.uomId,
  });

  await validateCustomDataAgainstPublishedMetadata(ctx, "Item", data.customData);

  const sku = data.sku?.trim()
    ? data.sku.trim()
    : (
        await allocateCompanyRequiredSeriesNumber(ctx, {
          key: "SKU",
        })
      ).number;

  await ensureSkuAvailable({
    companyId: ctx.companyId,
    brandId: data.brandId,
    sku,
  });

  const normalizedSku = normalizeSku(sku);

  const created = await prisma.product.create({
    data: {
      companyId: ctx.companyId,
      brandId: data.brandId,
      sku,
      normalizedSku,
      name: data.name,
      title: data.name,
      description: data.description ?? null,
      categoryId: data.categoryId ?? null,
      subCategoryId: data.subCategoryId ?? null,
      itemGroupId: data.itemGroupId ?? null,
      uomId: data.uomId ?? null,
      uom: data.uom ?? "pcs",
      barcode: data.barcode ?? null,
      itemType: data.itemType ?? null,
      itemStatus: data.itemStatus ?? "DRAFT",
      unitCostMinor: data.unitCostMinor ?? 0,
      priceCents: data.priceCents ?? 0,
      customData: (data.customData ?? {}) as never,
      isActive: data.isActive ?? true,
      createdBy: ctx.userId,
      assignedTo: ctx.userId,
    },
  });

  await appendAuditEvent(ctx, {
    source: "master.item",
    action: "master.item.created",
    entityType: "Product",
    entityId: created.id,
    after: {
      id: created.id,
      sku: created.sku,
      name: created.name,
      barcode: created.barcode,
    },
  });

  return loadItemOrThrow(ctx, created.id);
}

export async function updateMasterItem(ctx: PlatformRequestContext, itemId: string, input: unknown) {
  await seedCoreMetaModels(ctx);
  const parsed = masterItemUpsertSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid item payload", parsed.error.flatten());
  }

  const data = parsed.data;
  const existing = await loadItemOrThrow(ctx, itemId);

  if (data.brandId) {
    await assertBrandForCompany(ctx, data.brandId);
  }

  await assertOptionalLookupIds(ctx, {
    categoryId: data.categoryId,
    subCategoryId: data.subCategoryId,
    itemGroupId: data.itemGroupId,
    uomId: data.uomId,
  });

  if (data.customData !== undefined) {
    await validateCustomDataAgainstPublishedMetadata(ctx, "Item", data.customData);
  }

  const nextStatus = data.itemStatus ?? existing.itemStatus;
  if (nextStatus && existing.itemStatus && nextStatus !== existing.itemStatus) {
    await enforcePublishedWorkflowTransition(ctx, {
      modelName: "Item",
      fromState: existing.itemStatus,
      toState: nextStatus,
      actionKey: "STATUS_CHANGE",
    });
  }

  const nextBrandId = data.brandId ?? existing.brandId;
  const nextSku = data.sku?.trim() || existing.sku;
  await ensureSkuAvailable({
    companyId: ctx.companyId,
    brandId: nextBrandId,
    sku: nextSku,
    itemIdToIgnore: existing.id,
  });

  const updated = await prisma.product.update({
    where: { id: existing.id },
    data: {
      brandId: nextBrandId,
      sku: nextSku,
      normalizedSku: normalizeSku(nextSku),
      name: data.name,
      title: data.name,
      description: data.description,
      categoryId: data.categoryId,
      subCategoryId: data.subCategoryId,
      itemGroupId: data.itemGroupId,
      uomId: data.uomId,
      uom: data.uom,
      barcode: data.barcode,
      itemType: data.itemType,
      itemStatus: nextStatus,
      unitCostMinor: data.unitCostMinor,
      priceCents: data.priceCents,
      customData: data.customData === undefined ? undefined : ((data.customData ?? {}) as never),
      isActive: data.isActive,
    },
  });

  await appendAuditEvent(ctx, {
    source: "master.item",
    action: "master.item.updated",
    entityType: "Product",
    entityId: updated.id,
    before: {
      sku: existing.sku,
      name: existing.name,
      itemStatus: existing.itemStatus,
    },
    after: {
      sku: updated.sku,
      name: updated.name,
      itemStatus: updated.itemStatus,
    },
  });

  return loadItemOrThrow(ctx, updated.id);
}
