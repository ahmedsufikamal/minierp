import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  applyInventoryDocumentAction,
  createInventoryDocument,
} from "@/modules/inventory/application/documents.service";
import {
  applyInventoryReconciliation,
  previewInventoryReconciliation,
} from "@/modules/inventory/application/reconciliation.service";
import {
  createInventoryReservation,
  releaseInventoryReservation,
} from "@/modules/inventory/application/reservations.service";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("inventory wave2 integration", () => {
  const marker = `inv-wave2-${Date.now()}`;
  const companyId = marker;

  let brandId = "";
  let standardItemId = "";
  let trackedItemId = "";
  let warehouseId = "";

  const ctx: InventoryRequestContext = {
    requestId: `${marker}-request`,
    companyId,
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

    const standardItem = await prisma.product.create({
      data: {
        companyId,
        brandId,
        sku: `${marker}-sku-std`,
        normalizedSku: `${marker}-sku-std`,
        name: "Wave2 Standard Item",
        uom: "pcs",
        unitCostMinor: 500,
        priceCents: 900,
      },
      select: { id: true },
    });
    standardItemId = standardItem.id;

    const trackedItem = await prisma.product.create({
      data: {
        companyId,
        brandId,
        sku: `${marker}-sku-tracked`,
        normalizedSku: `${marker}-sku-tracked`,
        name: "Wave2 Tracked Item",
        uom: "pcs",
        unitCostMinor: 700,
        priceCents: 1200,
        trackSerial: true,
        trackBatch: true,
      },
      select: { id: true },
    });
    trackedItemId = trackedItem.id;

    const warehouse = await prisma.inventoryWarehouse.create({
      data: {
        companyId,
        code: `${marker}-wh`,
        name: "Wave2 Warehouse",
      },
      select: { id: true },
    });
    warehouseId = warehouse.id;

    await prisma.inventoryStockBalance.create({
      data: {
        companyId,
        itemId: standardItemId,
        warehouseId,
        locationId: null,
        onHand: 20,
        reserved: 0,
        incoming: 0,
        outgoing: 0,
        avgCostMinor: 500,
      },
    });
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { companyId } });
    await prisma.immutableLedgerEvent.deleteMany({ where: { companyId } });
    await prisma.auditEvent.deleteMany({ where: { companyId } });

    await prisma.inventoryLedgerEntry.deleteMany({ where: { companyId } });
    await prisma.inventoryDocumentLine.deleteMany({ where: { companyId } });
    await prisma.inventoryWorkflowState.deleteMany({ where: { companyId } });
    await prisma.inventoryDocument.deleteMany({ where: { companyId } });
    await prisma.inventoryReservation.deleteMany({ where: { companyId } });
    await prisma.inventorySerial.deleteMany({ where: { companyId } });
    await prisma.inventoryBatch.deleteMany({ where: { companyId } });
    await prisma.inventoryStockBalance.deleteMany({ where: { companyId } });
    await prisma.inventoryAuditLog.deleteMany({ where: { companyId } });
    await prisma.inventoryIdempotencyKey.deleteMany({ where: { companyId } });
    await prisma.inventoryWarehouse.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.brand.deleteMany({ where: { companyId } });
  });

  it("supports reservations, serial/batch posting, reconciliation, and immutable hooks", async () => {
    const reservation = await createInventoryReservation(ctx, {
      itemId: standardItemId,
      warehouseId,
      quantity: 6,
      referenceType: "SALES_ORDER",
      referenceId: `${marker}-so-001`,
    });

    expect(reservation.status).toBe("ACTIVE");

    const balanceAfterReservation = await prisma.inventoryStockBalance.findFirst({
      where: {
        companyId,
        itemId: standardItemId,
        warehouseId,
        locationId: null,
      },
      select: { reserved: true },
    });
    expect(balanceAfterReservation?.reserved).toBe(6);

    const released = await releaseInventoryReservation(ctx, reservation.id, {
      reason: "test-release",
    });
    expect(released.status).toBe("RELEASED");

    const balanceAfterRelease = await prisma.inventoryStockBalance.findFirst({
      where: {
        companyId,
        itemId: standardItemId,
        warehouseId,
        locationId: null,
      },
      select: { reserved: true },
    });
    expect(balanceAfterRelease?.reserved).toBe(0);

    const trackedReceipt = await createInventoryDocument(ctx, {
      documentType: "RECEIPT",
      number: `${marker}-rcv-${Date.now()}`,
      destinationWarehouseId: warehouseId,
      lines: [
        {
          itemId: trackedItemId,
          quantity: 2,
          unitCostMinor: 700,
          currency: "BDT",
          batchCode: `${marker}-batch-001`,
          serialNumbers: [`${marker}-SER-001`, `${marker}-SER-002`],
        },
      ],
    });

    await applyInventoryDocumentAction(ctx, trackedReceipt.id, { action: "SUBMIT" });
    await applyInventoryDocumentAction(ctx, trackedReceipt.id, { action: "APPROVE" });
    await applyInventoryDocumentAction(ctx, trackedReceipt.id, {
      action: "POST",
      idempotencyKey: crypto.randomUUID(),
    });

    const trackedBatch = await prisma.inventoryBatch.findFirst({
      where: {
        companyId,
        itemId: trackedItemId,
        warehouseId,
        batchCode: `${marker}-batch-001`,
      },
      select: { quantityOnHand: true },
    });
    expect(trackedBatch?.quantityOnHand).toBe(2);

    const trackedSerials = await prisma.inventorySerial.findMany({
      where: {
        companyId,
        itemId: trackedItemId,
      },
      select: { serialNumber: true, status: true, warehouseId: true },
      orderBy: { serialNumber: "asc" },
    });
    expect(trackedSerials).toHaveLength(2);
    expect(trackedSerials.every((row) => row.status === "AVAILABLE")).toBe(true);
    expect(trackedSerials.every((row) => row.warehouseId === warehouseId)).toBe(true);

    const activeReservation = await createInventoryReservation(ctx, {
      itemId: standardItemId,
      warehouseId,
      quantity: 3,
      referenceType: "SALES_ORDER",
      referenceId: `${marker}-so-002`,
    });

    const issueDoc = await createInventoryDocument(ctx, {
      documentType: "ISSUE",
      number: `${marker}-iss-${Date.now()}`,
      sourceWarehouseId: warehouseId,
      lines: [
        {
          itemId: standardItemId,
          quantity: 3,
          unitCostMinor: 500,
          currency: "BDT",
          reservationId: activeReservation.id,
        },
      ],
    });

    await applyInventoryDocumentAction(ctx, issueDoc.id, { action: "SUBMIT" });
    await applyInventoryDocumentAction(ctx, issueDoc.id, { action: "APPROVE" });
    await applyInventoryDocumentAction(ctx, issueDoc.id, {
      action: "POST",
      idempotencyKey: crypto.randomUUID(),
    });

    const consumedReservation = await prisma.inventoryReservation.findFirst({
      where: { id: activeReservation.id, companyId },
      select: { status: true, fulfilledQty: true },
    });
    expect(consumedReservation?.status).toBe("CONSUMED");
    expect(consumedReservation?.fulfilledQty).toBe(3);

    const preview = await previewInventoryReconciliation(ctx, {
      warehouseId,
      lines: [
        {
          itemId: standardItemId,
          countedQty: 12,
          unitCostMinor: 500,
        },
      ],
    });
    expect(preview.lines[0]?.deltaQty).toBe(-5);

    const reconciliation = await applyInventoryReconciliation(ctx, {
      warehouseId,
      reason: "cycle-count",
      lines: [
        {
          itemId: standardItemId,
          countedQty: 12,
          unitCostMinor: 500,
        },
      ],
    }, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(reconciliation.posted.status).toBe("POSTED");

    const standardBalance = await prisma.inventoryStockBalance.findFirst({
      where: {
        companyId,
        itemId: standardItemId,
        warehouseId,
        locationId: null,
      },
      select: { onHand: true },
    });
    expect(standardBalance?.onHand).toBe(12);

    const immutableEvents = await prisma.immutableLedgerEvent.findMany({
      where: { companyId, stream: "inventory" },
      select: { eventType: true, entityType: true },
    });
    expect(immutableEvents.length).toBeGreaterThan(0);
    expect(immutableEvents.some((row) => row.entityType === "InventoryReservation")).toBe(
      true,
    );
    expect(
      immutableEvents.some((row) => row.eventType === "RECONCILIATION_APPLIED"),
    ).toBe(true);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { companyId, topic: "inventory.audit" },
      select: { id: true },
    });
    expect(outboxEvents.length).toBeGreaterThan(0);
  });
});
