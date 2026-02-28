import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendAuditEvent } from "@/modules/platform/application/audit-ledger.service";
import { enforcePublishedWorkflowTransition, seedCoreMetaModels } from "@/modules/platform/application/meta-model.service";
import { masterPriceListUpsertSchema } from "@/modules/platform/domain/meta-master-schemas";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
  return value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export async function listMasterUoms(ctx: PlatformRequestContext) {
  await seedCoreMetaModels(ctx);
  return prisma.setupUom.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      isActive: true,
    },
    include: {
      fromConversions: {
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
        },
        include: {
          toUom: {
            select: {
              id: true,
              name: true,
              symbol: true,
            },
          },
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function listMasterPriceLists(ctx: PlatformRequestContext) {
  await seedCoreMetaModels(ctx);
  return prisma.masterPriceList.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      isActive: true,
    },
    include: {
      items: {
        where: { isActive: true },
        orderBy: [{ itemCode: "asc" }],
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function upsertMasterPriceList(ctx: PlatformRequestContext, input: unknown) {
  await seedCoreMetaModels(ctx);
  const parsed = masterPriceListUpsertSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid price list payload", parsed.error.flatten());
  }

  const data = parsed.data;

  const existing = await prisma.masterPriceList.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      key: data.key,
    },
    include: {
      items: true,
    },
  });

  if (existing && data.status !== existing.status) {
    await enforcePublishedWorkflowTransition(ctx, {
      modelName: "PriceList",
      fromState: existing.status,
      toState: data.status,
      actionKey: "STATUS_CHANGE",
    });
  }

  const savedId = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.masterPriceList.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          currency: data.currency,
          status: data.status,
          validFrom: data.validFrom ?? null,
          validTo: data.validTo ?? null,
          isDefault: data.isDefault ?? false,
          isActive: data.isActive ?? true,
          updatedBy: ctx.userId,
        },
      });

      await tx.masterPriceListItem.deleteMany({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          priceListId: existing.id,
        },
      });

      if (data.items.length > 0) {
        await tx.masterPriceListItem.createMany({
          data: data.items.map((entry) => ({
            tenantId: ctx.tenantId,
            companyId: ctx.companyId,
            priceListId: existing.id,
            itemCode: entry.itemCode,
            productId: entry.productId ?? null,
            uomId: entry.uomId ?? null,
            minQty: entry.minQty ?? null,
            rate: entry.rate,
            currency: entry.currency,
            isActive: entry.isActive ?? true,
            metadata: toJsonValue(entry.metadata ?? null),
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })),
        });
      }

      return existing.id;
    }

    const created = await tx.masterPriceList.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        key: data.key,
        name: data.name,
        currency: data.currency,
        status: data.status,
        validFrom: data.validFrom ?? null,
        validTo: data.validTo ?? null,
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });

    if (data.items.length > 0) {
      await tx.masterPriceListItem.createMany({
        data: data.items.map((entry) => ({
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          priceListId: created.id,
          itemCode: entry.itemCode,
          productId: entry.productId ?? null,
          uomId: entry.uomId ?? null,
          minQty: entry.minQty ?? null,
          rate: entry.rate,
          currency: entry.currency,
          isActive: entry.isActive ?? true,
          metadata: toJsonValue(entry.metadata ?? null),
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })),
      });
    }

    return created.id;
  });

  const latest = await prisma.masterPriceList.findFirst({
    where: {
      id: savedId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    include: {
      items: {
        where: { isActive: true },
        orderBy: [{ itemCode: "asc" }],
      },
    },
  });

  if (!latest) {
    throw new PlatformError("INTERNAL_ERROR", "Unable to load saved price list");
  }

  await appendAuditEvent(ctx, {
    source: "master.pricelist",
    action: existing ? "master.pricelist.updated" : "master.pricelist.created",
    entityType: "MasterPriceList",
    entityId: latest.id,
    before: existing
      ? {
          key: existing.key,
          status: existing.status,
          itemCount: existing.items.length,
        }
      : undefined,
    after: {
      key: latest.key,
      status: latest.status,
      itemCount: latest.items.length,
    },
  });

  return latest;
}

export async function listMasterCurrencies(ctx: PlatformRequestContext) {
  await seedCoreMetaModels(ctx);
  return prisma.masterCurrency.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      isActive: true,
    },
    orderBy: [{ code: "asc" }],
  });
}

export async function listMasterTaxCodes(ctx: PlatformRequestContext) {
  await seedCoreMetaModels(ctx);
  return prisma.masterTaxCode.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      isActive: true,
    },
    orderBy: [{ code: "asc" }],
  });
}

export async function listMasterWarehouses(ctx: PlatformRequestContext) {
  await seedCoreMetaModels(ctx);
  return prisma.inventoryWarehouse.findMany({
    where: {
      companyId: ctx.companyId,
      isActive: true,
    },
    include: {
      locations: {
        where: { isActive: true },
        orderBy: [{ code: "asc" }],
      },
    },
    orderBy: [{ code: "asc" }],
  });
}
