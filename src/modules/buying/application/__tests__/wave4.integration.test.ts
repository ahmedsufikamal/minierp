import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  applyMaterialRequestAction,
  createMaterialRequest,
} from "@/modules/buying/application/material-requests.service";
import { applyPurchaseReceiptAction, createPurchaseReceipt } from "@/modules/buying/application/purchase-receipts.service";
import { applyRfqAction, createRfq } from "@/modules/buying/application/rfqs.service";
import {
  applySupplierQuotationAction,
  createSupplierQuotation,
} from "@/modules/buying/application/supplier-quotations.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("buying wave4 integration", () => {
  const marker = `buying-wave4-${Date.now()}`;
  const companyId = marker;
  const tenantId = marker;

  let brandId = "";
  let productId = "";
  let vendorId = "";
  let warehouseId = "";
  let purchaseOrderId = "";
  let purchaseOrderLineId = "";

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
        name: "Wave4 Buying Item",
        uom: "pcs",
        unitCostMinor: 100,
        priceCents: 200,
      },
      select: { id: true },
    });
    productId = product.id;

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
        name: "Wave4 Warehouse",
      },
      select: { id: true },
    });
    warehouseId = warehouse.id;

    const po = await prisma.purchaseOrder.create({
      data: {
        companyId,
        number: `${marker}-PO-001`,
        status: "SENT",
        vendorId,
        lines: {
          create: [
            {
              productId,
              description: "Wave4 PO line",
              qtyOrdered: 5,
              unitPriceCents: 100,
            },
          ],
        },
      },
      include: {
        lines: {
          orderBy: [{ id: "asc" }],
        },
      },
    });
    purchaseOrderId = po.id;
    purchaseOrderLineId = po.lines[0]!.id;
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { companyId } });

    await prisma.inventoryLedgerEntry.deleteMany({ where: { companyId } });
    await prisma.inventoryDocumentLine.deleteMany({ where: { companyId } });
    await prisma.inventoryWorkflowState.deleteMany({ where: { companyId } });
    await prisma.inventoryDocument.deleteMany({ where: { companyId } });
    await prisma.inventoryStockBalance.deleteMany({ where: { companyId } });
    await prisma.inventoryAuditLog.deleteMany({ where: { companyId } });
    await prisma.inventoryIdempotencyKey.deleteMany({ where: { companyId } });

    await prisma.purchaseReceiptLine.deleteMany({ where: { purchaseReceipt: { companyId } } });
    await prisma.purchaseReceipt.deleteMany({ where: { companyId } });
    await prisma.supplierQuotationLine.deleteMany({ where: { supplierQuotation: { companyId } } });
    await prisma.supplierQuotation.deleteMany({ where: { companyId } });
    await prisma.requestForQuotationVendor.deleteMany({ where: { requestForQuotation: { companyId } } });
    await prisma.requestForQuotationLine.deleteMany({ where: { requestForQuotation: { companyId } } });
    await prisma.requestForQuotation.deleteMany({ where: { companyId } });
    await prisma.materialRequestLine.deleteMany({ where: { materialRequest: { companyId } } });
    await prisma.materialRequest.deleteMany({ where: { companyId } });

    await prisma.purchaseOrderLine.deleteMany({ where: { order: { companyId } } });
    await prisma.purchaseOrder.deleteMany({ where: { companyId } });

    await prisma.inventoryWarehouse.deleteMany({ where: { companyId } });
    await prisma.vendor.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.brand.deleteMany({ where: { companyId } });
  });

  it("runs buying chain and posts purchase receipt to inventory with tolerance guardrail", async () => {
    const mr = await createMaterialRequest(ctx, {
      number: `${marker}-MR-001`,
      lines: [
        {
          productId,
          description: "Need stock",
          qtyRequested: 5,
          preferredVendorId: vendorId,
        },
      ],
    });

    await applyMaterialRequestAction(ctx, mr.id, { action: "SUBMIT" });
    const approvedMr = await applyMaterialRequestAction(ctx, mr.id, { action: "APPROVE" });
    expect(approvedMr.status).toBe("APPROVED");

    const rfq = await createRfq(ctx, {
      number: `${marker}-RFQ-001`,
      materialRequestId: mr.id,
      vendorIds: [vendorId],
      lines: [
        {
          materialRequestLineId: mr.lines[0]?.id,
          productId,
          description: "Quote this item",
          qty: 5,
          uom: "pcs",
        },
      ],
    });

    const sentRfq = await applyRfqAction(ctx, rfq.id, { action: "SEND" });
    expect(sentRfq?.status).toBe("SENT");

    const supplierQuotation = await createSupplierQuotation(ctx, {
      number: `${marker}-SQ-001`,
      vendorId,
      requestForQuotationId: rfq.id,
      lines: [
        {
          requestForQuotationLineId: rfq.lines[0]?.id,
          productId,
          description: "Quoted item",
          qty: 5,
          unitPriceCents: 95,
          deliveryDays: 3,
        },
      ],
    });

    await applySupplierQuotationAction(ctx, supplierQuotation.id, { action: "SUBMIT" });
    const acceptedQuotation = await applySupplierQuotationAction(ctx, supplierQuotation.id, { action: "ACCEPT" });
    expect(acceptedQuotation?.status).toBe("ACCEPTED");

    const receipt = await createPurchaseReceipt(ctx, {
      number: `${marker}-PR-001`,
      vendorId,
      purchaseOrderId,
      supplierQuotationId: supplierQuotation.id,
      destinationWarehouseId: warehouseId,
      lines: [
        {
          purchaseOrderLineId,
          productId,
          description: "Receive partial",
          qtyReceived: 2,
          unitCostMinor: 95,
          currency: "BDT",
        },
      ],
    });

    await applyPurchaseReceiptAction(ctx, receipt.id, { action: "SUBMIT" });
    await applyPurchaseReceiptAction(ctx, receipt.id, { action: "APPROVE" });
    const postedReceipt = await applyPurchaseReceiptAction(ctx, receipt.id, { action: "POST" });

    expect(postedReceipt?.status).toBe("POSTED");

    const poLine = await prisma.purchaseOrderLine.findUnique({
      where: { id: purchaseOrderLineId },
      select: { qtyOrdered: true, qtyReceived: true },
    });
    expect(poLine?.qtyOrdered).toBe(5);
    expect(poLine?.qtyReceived).toBe(2);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { status: true },
    });
    expect(po?.status).toBe("PARTIALLY_RECEIVED");

    const balance = await prisma.inventoryStockBalance.findFirst({
      where: {
        companyId,
        itemId: productId,
        warehouseId,
        locationId: null,
      },
      select: { onHand: true },
    });
    expect(balance?.onHand).toBe(2);

    const invalidReceipt = await createPurchaseReceipt(ctx, {
      number: `${marker}-PR-002`,
      vendorId,
      purchaseOrderId,
      destinationWarehouseId: warehouseId,
      lines: [
        {
          purchaseOrderLineId,
          productId,
          description: "Over receive",
          qtyReceived: 10,
          unitCostMinor: 95,
          currency: "BDT",
        },
      ],
    });

    await applyPurchaseReceiptAction(ctx, invalidReceipt.id, { action: "SUBMIT" });
    await applyPurchaseReceiptAction(ctx, invalidReceipt.id, { action: "APPROVE" });

    await expect(
      applyPurchaseReceiptAction(ctx, invalidReceipt.id, { action: "POST" }),
    ).rejects.toThrow(/exceeds PO tolerance/i);
  });
});
