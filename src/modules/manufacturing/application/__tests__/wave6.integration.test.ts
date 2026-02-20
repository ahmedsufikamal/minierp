import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyBomAction, createBom } from "@/modules/manufacturing/application/boms.service";
import { applyJobCardAction, createJobCard } from "@/modules/manufacturing/application/job-cards.service";
import { createRouting } from "@/modules/manufacturing/application/routings.service";
import { applyWorkOrderAction, createWorkOrder } from "@/modules/manufacturing/application/work-orders.service";
import { applyQualityInspectionAction, createQualityInspection } from "@/modules/quality/application/inspections.service";
import {
  applySubcontractingOrderAction,
  createSubcontractingOrder,
} from "@/modules/subcontracting/application/orders.service";
import {
  applySubcontractingReceiptAction,
  createSubcontractingReceipt,
} from "@/modules/subcontracting/application/receipts.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("wave6 manufacturing-subcontracting-quality integration", () => {
  const marker = `wave6-${Date.now()}`;
  const companyId = marker;
  const tenantId = marker;

  let brandId = "";
  let finishedItemId = "";
  let componentItemId = "";
  let vendorId = "";
  let warehouseId = "";
  let workstationId = "";

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

    const finishedItem = await prisma.product.create({
      data: {
        companyId,
        brandId,
        sku: `${marker}-fg`,
        normalizedSku: `${marker}-fg`,
        name: "Wave6 Finished Item",
        uom: "pcs",
      },
      select: { id: true },
    });
    finishedItemId = finishedItem.id;

    const componentItem = await prisma.product.create({
      data: {
        companyId,
        brandId,
        sku: `${marker}-rm`,
        normalizedSku: `${marker}-rm`,
        name: "Wave6 Raw Material",
        uom: "pcs",
      },
      select: { id: true },
    });
    componentItemId = componentItem.id;

    const vendor = await prisma.vendor.create({
      data: {
        companyId,
        name: `${marker}-vendor`,
      },
      select: { id: true },
    });
    vendorId = vendor.id;

    const warehouse = await prisma.inventoryWarehouse.create({
      data: {
        companyId,
        code: `${marker}-wh`,
        name: "Wave6 Warehouse",
      },
      select: { id: true },
    });
    warehouseId = warehouse.id;

    await prisma.inventoryStockBalance.create({
      data: {
        companyId,
        itemId: componentItemId,
        warehouseId,
        locationId: null,
        onHand: 100,
        reserved: 0,
        incoming: 0,
        outgoing: 0,
      },
    });

    const workstation = await prisma.workstation.create({
      data: {
        tenantId,
        companyId,
        code: `${marker}-ws`,
        name: "Assembly WS",
        capacityMinsPerDay: 480,
      },
      select: { id: true },
    });
    workstationId = workstation.id;
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { companyId } });

    await prisma.qualityCapa.deleteMany({ where: { companyId } });
    await prisma.qualityInspection.deleteMany({ where: { companyId } });

    await prisma.subcontractingReceiptItem.deleteMany({ where: { receipt: { companyId } } });
    await prisma.subcontractingReceipt.deleteMany({ where: { companyId } });
    await prisma.subcontractingOrderItem.deleteMany({ where: { order: { companyId } } });
    await prisma.subcontractingOrder.deleteMany({ where: { companyId } });

    await prisma.jobCard.deleteMany({ where: { companyId } });
    await prisma.workOrder.deleteMany({ where: { companyId } });
    await prisma.bomLine.deleteMany({ where: { bom: { companyId } } });
    await prisma.bom.deleteMany({ where: { companyId } });
    await prisma.routingOperation.deleteMany({ where: { routing: { companyId } } });
    await prisma.routing.deleteMany({ where: { companyId } });
    await prisma.workstation.deleteMany({ where: { companyId } });

    await prisma.inventoryReservation.deleteMany({ where: { companyId } });
    await prisma.inventoryStockBalance.deleteMany({ where: { companyId } });
    await prisma.inventoryAuditLog.deleteMany({ where: { companyId } });

    await prisma.inventoryWarehouse.deleteMany({ where: { companyId } });
    await prisma.vendor.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.brand.deleteMany({ where: { companyId } });
  });

  it("enforces reservation and failed-inspection blocking on job card and subcontracting receipt", async () => {
    const bom = await createBom(ctx, {
      code: `${marker}-BOM-001`,
      itemId: finishedItemId,
      quantity: 1,
      isDefault: true,
      lines: [
        {
          itemId: componentItemId,
          quantity: 2,
        },
      ],
    });

    const activeBom = await applyBomAction(ctx, bom.id, { action: "ACTIVATE" });
    expect(activeBom.status).toBe("ACTIVE");

    const routing = await createRouting(ctx, {
      code: `${marker}-RT-001`,
      name: "Assembly Route",
      operations: [
        {
          operationName: "Assemble",
          workstationId,
          durationMins: 120,
        },
      ],
    });

    const workOrder = await createWorkOrder(ctx, {
      number: `${marker}-WO-001`,
      bomId: bom.id,
      routingId: routing.id,
      itemId: finishedItemId,
      qtyPlanned: 2,
      reservationWarehouseId: warehouseId,
    });

    const releasedOrder = await applyWorkOrderAction(ctx, workOrder.id, { action: "RELEASE" });
    expect(releasedOrder.status).toBe("RELEASED");

    const reservation = await prisma.inventoryReservation.findFirst({
      where: {
        companyId,
        referenceType: "WORK_ORDER",
        referenceId: workOrder.id,
        itemId: componentItemId,
      },
      select: { quantity: true, status: true },
    });
    expect(reservation?.quantity).toBe(4);
    expect(reservation?.status).toBe("ACTIVE");

    const jobCard = await createJobCard(ctx, {
      workOrderId: workOrder.id,
      operationNo: 1,
      operationName: "Assemble",
      workstationId,
      plannedMins: 120,
    });

    await applyJobCardAction(ctx, jobCard.id, { action: "START" });

    const failedInspection = await createQualityInspection(ctx, {
      number: `${marker}-QI-001`,
      referenceType: "JOB_CARD",
      referenceId: jobCard.id,
      itemId: finishedItemId,
      qtyInspected: 2,
      qtyAccepted: 0,
      qtyRejected: 2,
    });

    await applyQualityInspectionAction(ctx, failedInspection.id, { action: "FAIL" });

    await expect(
      applyJobCardAction(ctx, jobCard.id, { action: "COMPLETE", actualMins: 130 }),
    ).rejects.toThrow(/failed inspections/i);

    const subOrder = await createSubcontractingOrder(ctx, {
      number: `${marker}-SO-001`,
      vendorId,
      issueWarehouseId: warehouseId,
      items: [
        {
          itemId: componentItemId,
          description: "Outsource processing",
          qtyOutward: 3,
        },
      ],
    });

    await applySubcontractingOrderAction(ctx, subOrder.id, { action: "SUBMIT" });
    await applySubcontractingOrderAction(ctx, subOrder.id, { action: "START" });

    const receipt = await createSubcontractingReceipt(ctx, {
      number: `${marker}-SR-001`,
      subcontractingOrderId: subOrder.id,
      vendorId,
      destinationWarehouseId: warehouseId,
      items: [
        {
          orderItemId: subOrder.items[0]?.id,
          itemId: componentItemId,
          description: "Processed material",
          qtyReceived: 2,
          qtyRejected: 0,
        },
      ],
    });

    await applySubcontractingReceiptAction(ctx, receipt.id, { action: "SUBMIT" });

    const failedReceiptInspection = await createQualityInspection(ctx, {
      number: `${marker}-QI-002`,
      referenceType: "SUBCONTRACTING_RECEIPT",
      referenceId: receipt.id,
      itemId: componentItemId,
      qtyInspected: 2,
      qtyAccepted: 0,
      qtyRejected: 2,
    });

    await applyQualityInspectionAction(ctx, failedReceiptInspection.id, { action: "FAIL" });

    await expect(
      applySubcontractingReceiptAction(ctx, receipt.id, { action: "ACCEPT" }),
    ).rejects.toThrow(/failed inspections/i);
  });
});
