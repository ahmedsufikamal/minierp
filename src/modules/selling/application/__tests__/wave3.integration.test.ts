import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyDeliveryNoteAction, createDeliveryNote } from "@/modules/selling/application/delivery-notes.service";
import { applySalesOrderAction, createSalesOrder } from "@/modules/selling/application/sales-orders.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("selling wave3 integration", () => {
  const marker = `selling-wave3-${Date.now()}`;
  const companyId = marker;
  const tenantId = marker;

  let brandId = "";
  let productId = "";
  let customerId = "";
  let warehouseId = "";

  const ctx: PlatformRequestContext = {
    requestId: `${marker}-request`,
    tenantId,
    companyId,
    userId: `${marker}-user`,
    role: "OWNER",
    platformRole: "SUPER_ADMIN",
    permissions: [],
  };

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;

    const brand = await prisma.brand.create({
      data: {
        companyId,
        name: `${marker}-brand`,
      },
      select: { id: true },
    });
    brandId = brand.id;

    const product = await prisma.product.create({
      data: {
        companyId,
        brandId,
        sku: `${marker}-sku`,
        normalizedSku: `${marker}-sku`,
        name: "Wave3 Selling Item",
        uom: "pcs",
        unitCostMinor: 100,
        priceCents: 200,
      },
      select: { id: true },
    });
    productId = product.id;

    const customer = await prisma.customer.create({
      data: {
        companyId,
        name: `${marker}-customer`,
      },
      select: { id: true },
    });
    customerId = customer.id;

    const warehouse = await prisma.inventoryWarehouse.create({
      data: {
        companyId,
        code: `${marker}-wh`,
        name: "Wave3 Warehouse",
      },
      select: { id: true },
    });
    warehouseId = warehouse.id;

    await prisma.inventoryStockBalance.create({
      data: {
        companyId,
        itemId: productId,
        warehouseId,
        locationId: null,
        onHand: 10,
        reserved: 0,
        incoming: 0,
        outgoing: 0,
        avgCostMinor: 100,
      },
    });
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { companyId } });

    await prisma.inventoryLedgerEntry.deleteMany({ where: { companyId } });
    await prisma.inventoryDocumentLine.deleteMany({ where: { companyId } });
    await prisma.inventoryWorkflowState.deleteMany({ where: { companyId } });
    await prisma.inventoryDocument.deleteMany({ where: { companyId } });
    await prisma.inventoryReservation.deleteMany({ where: { companyId } });
    await prisma.inventoryStockBalance.deleteMany({ where: { companyId } });
    await prisma.inventoryAuditLog.deleteMany({ where: { companyId } });
    await prisma.inventoryIdempotencyKey.deleteMany({ where: { companyId } });

    await prisma.deliveryNoteLine.deleteMany({ where: { deliveryNote: { companyId } } });
    await prisma.deliveryNote.deleteMany({ where: { companyId } });
    await prisma.salesOrderLine.deleteMany({ where: { salesOrder: { companyId } } });
    await prisma.salesOrder.deleteMany({ where: { companyId } });

    await prisma.inventoryWarehouse.deleteMany({ where: { companyId } });
    await prisma.customer.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.brand.deleteMany({ where: { companyId } });
  });

  it("creates sales order, reserves stock, and posts delivery note to inventory", async () => {
    const order = await createSalesOrder(ctx, {
      number: `${marker}-SO-001`,
      customerId,
      reservationWarehouseId: warehouseId,
      lines: [
        {
          productId,
          description: "Wave3 order line",
          qtyOrdered: 5,
          unitPriceCents: 250,
        },
      ],
    });

    await applySalesOrderAction(ctx, order.id, { action: "SUBMIT" });
    const approvedOrder = await applySalesOrderAction(ctx, order.id, { action: "APPROVE" });

    expect(approvedOrder.status).toBe("APPROVED");
    expect(approvedOrder.lines[0]?.reservationId).toBeTruthy();

    const note = await createDeliveryNote(ctx, {
      number: `${marker}-DN-001`,
      customerId,
      salesOrderId: order.id,
      sourceWarehouseId: warehouseId,
      lines: [
        {
          salesOrderLineId: approvedOrder.lines[0]?.id,
          productId,
          description: "Deliver partial",
          qty: 2,
          unitCostMinor: 100,
          currency: "BDT",
        },
      ],
    });

    await applyDeliveryNoteAction(ctx, note.id, { action: "SUBMIT" });
    await applyDeliveryNoteAction(ctx, note.id, { action: "APPROVE" });
    const postedNote = await applyDeliveryNoteAction(ctx, note.id, { action: "POST" });

    expect(postedNote?.status).toBe("POSTED");

    const refreshedOrder = await prisma.salesOrder.findUnique({
      where: { id: order.id },
      include: { lines: true },
    });

    expect(refreshedOrder?.status).toBe("PARTIALLY_DELIVERED");
    expect(refreshedOrder?.lines[0]?.qtyDelivered).toBe(2);

    const reservation = await prisma.inventoryReservation.findFirst({
      where: {
        companyId,
        referenceType: "SALES_ORDER",
        referenceId: order.id,
      },
      select: { fulfilledQty: true, status: true },
    });

    expect(reservation?.fulfilledQty).toBe(2);
    expect(reservation?.status).toBe("ACTIVE");

    const balance = await prisma.inventoryStockBalance.findFirst({
      where: {
        companyId,
        itemId: productId,
        warehouseId,
        locationId: null,
      },
      select: { onHand: true },
    });

    expect(balance?.onHand).toBe(8);
  });
});
