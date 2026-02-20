import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getInventoryItemById, listInventoryItems } from "@/modules/inventory/application/items.service";
import { updateReorderRule } from "@/modules/inventory/application/reorder.service";
import { updateWarehouse } from "@/modules/inventory/application/warehouses.service";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("inventory tenant isolation integration", () => {
  const marker = `inv-tenant-${Date.now()}`;
  const companyA = `${marker}-a`;
  const companyB = `${marker}-b`;

  let itemA = "";
  let itemB = "";
  let warehouseB = "";
  let reorderRuleB = "";

  const ctxA: InventoryRequestContext = {
    requestId: `${marker}-request-a`,
    companyId: companyA,
    tenantId: companyA,
    userId: `${marker}-user-a`,
    role: "COMPANY_ADMIN",
  };

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;

    const [brandA, brandB] = await Promise.all([
      prisma.brand.create({
        data: { companyId: companyA, name: `${marker}-brand-a` },
        select: { id: true },
      }),
      prisma.brand.create({
        data: { companyId: companyB, name: `${marker}-brand-b` },
        select: { id: true },
      }),
    ]);

    const [productA, productB] = await Promise.all([
      prisma.product.create({
        data: {
          companyId: companyA,
          brandId: brandA.id,
          sku: `${marker}-sku-a`,
          normalizedSku: `${marker}-sku-a`.toUpperCase(),
          name: "Tenant Item A",
          uom: "pcs",
          priceCents: 100,
          unitCostMinor: 100,
        },
        select: { id: true },
      }),
      prisma.product.create({
        data: {
          companyId: companyB,
          brandId: brandB.id,
          sku: `${marker}-sku-b`,
          normalizedSku: `${marker}-sku-b`.toUpperCase(),
          name: "Tenant Item B",
          uom: "pcs",
          priceCents: 200,
          unitCostMinor: 200,
        },
        select: { id: true },
      }),
    ]);
    itemA = productA.id;
    itemB = productB.id;

    const whB = await prisma.inventoryWarehouse.create({
      data: { companyId: companyB, code: `${marker}-whb`, name: "Tenant Warehouse B" },
      select: { id: true },
    });
    warehouseB = whB.id;

    const rule = await prisma.inventoryReorderRule.create({
      data: {
        companyId: companyB,
        itemId: itemB,
        warehouseId: warehouseB,
        minQty: 1,
        maxQty: 10,
        reorderPoint: 3,
        reorderQty: 5,
        leadTimeDays: 2,
      },
      select: { id: true },
    });
    reorderRuleB = rule.id;
  });

  afterAll(async () => {
    await prisma.inventoryNotification.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.inventoryReorderRule.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.inventoryWarehouseLocation.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.inventoryWarehouse.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.product.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.brand.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
  });

  it("returns only company-scoped rows for list queries", async () => {
    const result = await listInventoryItems(ctxA, { page: 1, limit: 50, includeCustom: false });
    const ids = result.rows.map((row) => row.id);

    expect(ids).toContain(itemA);
    expect(ids).not.toContain(itemB);
  });

  it("blocks cross-company item read by id", async () => {
    await expect(getInventoryItemById(ctxA, itemB)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("blocks cross-company warehouse update", async () => {
    await expect(updateWarehouse(ctxA, warehouseB, { name: "Should not update" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("blocks cross-company reorder-rule update", async () => {
    await expect(updateReorderRule(ctxA, reorderRuleB, { reorderQty: 99 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
