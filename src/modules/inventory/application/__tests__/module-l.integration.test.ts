import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("inventory module L integration", () => {
  const marker = `inv-module-l-${Date.now()}`;
  const companyId = marker;

  let brandId = "";
  let itemId = "";
  let warehouseId = "";
  let prisma: (typeof import("@/lib/prisma"))["prisma"];
  let adminOps: typeof import("@/modules/inventory/application/admin-ops.service");
  let documents: typeof import("@/modules/inventory/application/documents.service");

  const ctx: InventoryRequestContext = {
    requestId: `${marker}-request`,
    tenantId: `${marker}-tenant`,
    companyId,
    userId: `${marker}-user`,
    role: "COMPANY_ADMIN",
    iamPermissions: [
      "inventory.document.post",
      "inventory.document.approve",
      "inventory.ledger.read",
      "inventory.admin.ops",
    ],
  };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    adminOps = await import("@/modules/inventory/application/admin-ops.service");
    documents = await import("@/modules/inventory/application/documents.service");

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
        normalizedSku: `${marker}-sku`,
        name: "Module L Item",
        uom: "pcs",
        unitCostMinor: 100,
        priceCents: 180,
      },
      select: { id: true },
    });
    itemId = item.id;

    const warehouse = await prisma.inventoryWarehouse.create({
      data: {
        companyId,
        code: `${marker}-wh`,
        name: "Module L Warehouse",
      },
      select: { id: true },
    });
    warehouseId = warehouse.id;

    await prisma.inventoryCompanySetting.upsert({
      where: { companyId },
      create: {
        companyId,
        defaultValuationMethod: "FIFO",
        costingMethod: "FIFO",
        allowNegativeStock: false,
      },
      update: {
        defaultValuationMethod: "FIFO",
        costingMethod: "FIFO",
        allowNegativeStock: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.inventoryStockClosingLine.deleteMany({ where: { companyId } });
    await prisma.inventoryStockClosing.deleteMany({ where: { companyId } });
    await prisma.inventoryOpsJob.deleteMany({ where: { companyId } });
    await prisma.inventoryOutboxEvent.deleteMany({ where: { companyId } });
    await prisma.inventoryCostLayerAllocation.deleteMany({ where: { companyId } });
    await prisma.inventoryCostLayer.deleteMany({ where: { companyId } });
    await prisma.inventoryLedgerEntry.deleteMany({ where: { companyId } });
    await prisma.inventoryDocumentLine.deleteMany({ where: { companyId } });
    await prisma.inventoryWorkflowState.deleteMany({ where: { companyId } });
    await prisma.inventoryDocument.deleteMany({ where: { companyId } });
    await prisma.inventoryBatch.deleteMany({ where: { companyId } });
    await prisma.inventorySerial.deleteMany({ where: { companyId } });
    await prisma.inventoryStockBalance.deleteMany({ where: { companyId } });
    await prisma.inventoryIdempotencyKey.deleteMany({ where: { companyId } });
    await prisma.inventoryAuditLog.deleteMany({ where: { companyId } });
    await prisma.inventoryCompanySetting.deleteMany({ where: { companyId } });
    await prisma.inventoryWarehouse.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.brand.deleteMany({ where: { companyId } });
  });

  it("enforces posting idempotency and rejects mismatched payload reuse", async () => {
    const doc = await documents.createInventoryDocument(ctx, {
      documentType: "RECEIPT",
      number: `${marker}-doc-idem-1`,
      destinationWarehouseId: warehouseId,
      lines: [
        {
          itemId,
          quantity: 5,
          unitCostMinor: 100,
          currency: "BDT",
        },
      ],
    });

    await documents.applyInventoryDocumentAction(ctx, doc.id, { action: "SUBMIT" });
    await documents.applyInventoryDocumentAction(ctx, doc.id, { action: "APPROVE" });

    const idempotencyKey = crypto.randomUUID();
    await documents.applyInventoryDocumentAction(ctx, doc.id, {
      action: "POST",
      idempotencyKey,
    });
    const ledgerCountAfterFirst = await prisma.inventoryLedgerEntry.count({
      where: { companyId, documentId: doc.id },
    });

    await documents.applyInventoryDocumentAction(ctx, doc.id, {
      action: "POST",
      idempotencyKey,
    });
    const ledgerCountAfterSecond = await prisma.inventoryLedgerEntry.count({
      where: { companyId, documentId: doc.id },
    });
    expect(ledgerCountAfterSecond).toBe(ledgerCountAfterFirst);

    const docConflict = await documents.createInventoryDocument(ctx, {
      documentType: "RECEIPT",
      number: `${marker}-doc-idem-2`,
      destinationWarehouseId: warehouseId,
      lines: [
        {
          itemId,
          quantity: 1,
          unitCostMinor: 140,
          currency: "BDT",
        },
      ],
    });
    await documents.applyInventoryDocumentAction(ctx, docConflict.id, { action: "SUBMIT" });
    await documents.applyInventoryDocumentAction(ctx, docConflict.id, { action: "APPROVE" });

    await expect(
      documents.applyInventoryDocumentAction(ctx, docConflict.id, {
        action: "POST",
        idempotencyKey,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("variance report detects mismatch and repost rebuild clears it", async () => {
    const balance = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { companyId, itemId, warehouseId, locationId: null },
      select: { id: true, onHand: true, stockValueMinor: true },
    });

    await prisma.inventoryStockBalance.update({
      where: { id: balance.id },
      data: {
        onHand: balance.onHand + 3,
        stockValueMinor: balance.stockValueMinor + 300,
      },
    });

    const varianceBefore = await adminOps.generateInventoryVarianceReport(ctx, {
      itemId,
      warehouseId,
    });
    expect(varianceBefore.mismatchCount).toBeGreaterThan(0);

    const repostJob = await adminOps.enqueueInventoryRepostJob(
      ctx,
      {
        scope: {
          itemId,
          warehouseId,
          locationId: null,
        },
      },
      { idempotencyKey: crypto.randomUUID() },
    );

    if (repostJob.status !== "COMPLETED") {
      await adminOps.processInventoryOpsJobById(repostJob.id);
    }

    const varianceAfter = await adminOps.generateInventoryVarianceReport(ctx, {
      itemId,
      warehouseId,
    });
    expect(varianceAfter.mismatchCount).toBe(0);
  });

  it("stock closing snapshot matches ledger-derived totals for scope", async () => {
    const closing = await adminOps.enqueueInventoryStockClosingJob(
      ctx,
      {
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-12-31"),
        scope: { itemId, warehouseId, locationId: null },
      },
      { idempotencyKey: crypto.randomUUID() },
    );

    if (closing.job.status !== "COMPLETED") {
      await adminOps.processInventoryOpsJobById(closing.job.id);
    }

    const snapshot = await adminOps.readStockClosingSnapshot(ctx, { closingId: closing.closingId });
    const ledgerSnapshot = await adminOps.buildLedgerBasedStockSnapshot(ctx, {
      itemId,
      warehouseId,
      locationId: null,
    });

    const closingTotals = snapshot.lines.reduce(
      (acc, row) => {
        acc.qty += row.qtyOnHand;
        acc.value += row.stockValueMinor;
        return acc;
      },
      { qty: 0, value: 0 },
    );
    const ledgerTotals = ledgerSnapshot.reduce(
      (acc, row) => {
        acc.qty += row.qtyOnHand;
        acc.value += row.stockValueMinor;
        return acc;
      },
      { qty: 0, value: 0 },
    );

    expect(closingTotals.qty).toBe(ledgerTotals.qty);
    expect(closingTotals.value).toBe(ledgerTotals.value);
    expect(snapshot.lines.length).toBeGreaterThan(0);
  });
});
