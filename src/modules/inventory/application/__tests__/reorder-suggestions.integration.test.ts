import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createReorderRule, getReorderSuggestions, publishReorderSuggestionAlerts } from "@/modules/inventory/application/reorder.service";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("inventory reorder suggestions integration", () => {
  const marker = `inv-reorder-${Date.now()}`;
  const companyId = marker;

  let brandId = "";
  let itemId = "";
  let warehouseId = "";

  const ctx: InventoryRequestContext = {
    requestId: `${marker}-request`,
    companyId,
    tenantId: companyId,
    userId: `${marker}-user`,
    role: "COMPANY_ADMIN",
  };

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;

    const brand = await prisma.brand.create({
      data: { companyId, name: `${marker}-brand` },
      select: { id: true },
    });
    brandId = brand.id;

    const item = await prisma.product.create({
      data: {
        companyId,
        brandId,
        sku: `${marker}-sku`,
        normalizedSku: `${marker}-sku`.toUpperCase(),
        name: "Reorder Item",
        uom: "pcs",
        unitCostMinor: 100,
        priceCents: 100,
      },
      select: { id: true },
    });
    itemId = item.id;

    const warehouse = await prisma.inventoryWarehouse.create({
      data: {
        companyId,
        code: `${marker}-wh`,
        name: "Reorder Warehouse",
      },
      select: { id: true },
    });
    warehouseId = warehouse.id;

    await prisma.inventoryStockBalance.create({
      data: {
        companyId,
        itemId,
        warehouseId,
        locationId: null,
        onHand: 1,
        reserved: 0,
        incoming: 0,
        outgoing: 0,
        avgCostMinor: 100,
      },
    });

    await createReorderRule(ctx, {
      itemId,
      warehouseId,
      reorderPoint: 5,
      reorderQty: 10,
      minQty: 0,
      maxQty: 0,
      leadTimeDays: 2,
      isActive: true,
    });
  });

  afterAll(async () => {
    await prisma.inventoryNotification.deleteMany({ where: { companyId } });
    await prisma.inventoryReorderRule.deleteMany({ where: { companyId } });
    await prisma.inventoryStockBalance.deleteMany({ where: { companyId } });
    await prisma.inventoryWarehouseLocation.deleteMany({ where: { companyId } });
    await prisma.inventoryWarehouse.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.brand.deleteMany({ where: { companyId } });
  });

  it("keeps GET suggestions side-effect free and deduplicates explicit alert publishing", async () => {
    const first = await getReorderSuggestions(ctx);
    const second = await getReorderSuggestions(ctx);

    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);

    const notificationsAfterReads = await prisma.inventoryNotification.count({
      where: { companyId },
    });
    expect(notificationsAfterReads).toBe(0);

    const firstPublish = await publishReorderSuggestionAlerts(ctx, { dedupeWindowHours: 24 });
    expect(firstPublish.createdCount).toBeGreaterThan(0);

    const secondPublish = await publishReorderSuggestionAlerts(ctx, { dedupeWindowHours: 24 });
    expect(secondPublish.createdCount).toBe(0);
    expect(secondPublish.dedupedCount).toBeGreaterThan(0);

    const notificationsAfterPublish = await prisma.inventoryNotification.count({
      where: { companyId },
    });
    expect(notificationsAfterPublish).toBe(firstPublish.createdCount);
  });
});
