import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createInventoryDocument, applyInventoryDocumentAction } from "@/modules/inventory/application/documents.service";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("inventory document posting integration", () => {
  const companyId = `it-${Date.now()}`;
  const brandName = `IT-BRAND-${Date.now()}`;
  const warehouseCode = `IT-WH-${Date.now().toString().slice(-5)}`;

  let brandId = "";
  let itemId = "";
  let warehouseId = "";

  const ctx: InventoryRequestContext = {
    requestId: "it-doc-posting",
    companyId,
    userId: "integration-user",
    role: "COMPANY_ADMIN",
  };

  beforeAll(async () => {
    const brand = await prisma.brand.create({ data: { companyId, name: brandName } });
    brandId = brand.id;

    const item = await prisma.product.create({
      data: {
        companyId,
        brandId,
        sku: `IT-SKU-${Date.now()}`,
        normalizedSku: `IT-SKU-${Date.now()}`,
        name: "Integration Item",
        uom: "pcs",
        priceCents: 1000,
        unitCostMinor: 1000,
      },
    });
    itemId = item.id;

    const warehouse = await prisma.inventoryWarehouse.create({
      data: {
        companyId,
        code: warehouseCode,
        name: "Integration Warehouse",
      },
    });
    warehouseId = warehouse.id;
  });

  afterAll(async () => {
    await prisma.inventoryDocument.deleteMany({ where: { companyId } });
    await prisma.inventoryLedgerEntry.deleteMany({ where: { companyId } });
    await prisma.inventoryStockBalance.deleteMany({ where: { companyId } });
    await prisma.inventoryWarehouse.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.brand.deleteMany({ where: { companyId } });
  });

  it("creates, submits, approves, and posts a receipt document", async () => {
    const created = await createInventoryDocument(ctx, {
      documentType: "RECEIPT",
      number: `IT-DOC-${Date.now()}`,
      destinationWarehouseId: warehouseId,
      lines: [
        {
          itemId,
          quantity: 5,
          unitCostMinor: 1000,
          currency: "BDT",
        },
      ],
    });

    await applyInventoryDocumentAction(ctx, created.id, { action: "SUBMIT" });
    await applyInventoryDocumentAction(ctx, created.id, { action: "APPROVE" });
    const posted = await applyInventoryDocumentAction(ctx, created.id, {
      action: "POST",
      idempotencyKey: crypto.randomUUID(),
    });

    expect(posted.status).toBe("POSTED");

    const balance = await prisma.inventoryStockBalance.findUnique({
      where: {
        companyId_itemId_warehouseId_locationId: {
          companyId,
          itemId,
          warehouseId,
          locationId: null,
        },
      },
    });

    expect(balance?.onHand).toBe(5);

    const ledgerCount = await prisma.inventoryLedgerEntry.count({
      where: { companyId, documentId: created.id },
    });
    expect(ledgerCount).toBeGreaterThan(0);
  });
});
