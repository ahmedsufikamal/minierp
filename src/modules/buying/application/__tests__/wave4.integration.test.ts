import { AccountType } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  applyMaterialRequestAction,
  createMaterialRequest,
} from "@/modules/buying/application/material-requests.service";
import {
  applySupplierPaymentAction,
  createSupplierPayment,
  getPayablesAging,
  listSupplierPayments,
} from "@/modules/buying/application/payables.service";
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
  let purchaseBillId = "";
  let paidFromAccountId = "";
  let paidToAccountId = "";

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

    const purchaseBill = await prisma.purchaseBill.create({
      data: {
        companyId,
        number: `${marker}-PB-001`,
        vendorId,
        billDate: new Date("2026-01-01"),
        dueDate: new Date("2026-01-31"),
        lines: {
          create: [
            {
              description: "Wave4 bill line",
              qty: 5,
              unitPriceCents: 100,
            },
          ],
        },
      },
      select: { id: true },
    });
    purchaseBillId = purchaseBill.id;

    const paidFrom = await prisma.account.create({
      data: {
        tenantId,
        companyId,
        code: `${marker}-BANK`,
        name: "Bank",
        type: AccountType.ASSET,
      },
      select: { id: true },
    });
    paidFromAccountId = paidFrom.id;

    const paidTo = await prisma.account.create({
      data: {
        tenantId,
        companyId,
        code: `${marker}-AP`,
        name: "Accounts Payable",
        type: AccountType.LIABILITY,
      },
      select: { id: true },
    });
    paidToAccountId = paidTo.id;

    const fiscalYear = await prisma.fiscalYear.create({
      data: {
        tenantId,
        companyId,
        name: `${marker}-FY-2026`,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        isDefault: true,
      },
      select: { id: true },
    });

    await prisma.accountingPeriod.create({
      data: {
        tenantId,
        companyId,
        fiscalYearId: fiscalYear.id,
        name: `${marker}-P1`,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        status: "OPEN",
      },
    });
  });

  afterAll(async () => {
    await prisma.payableAgingSnapshot.deleteMany({ where: { companyId } });
    await prisma.supplierPaymentAllocation.deleteMany({ where: { supplierPayment: { companyId } } });
    await prisma.supplierPayment.deleteMany({ where: { companyId } });
    await prisma.paymentAllocation.deleteMany({ where: { paymentEntry: { companyId } } });
    await prisma.paymentEntry.deleteMany({ where: { companyId } });
    await prisma.gLEntry.deleteMany({ where: { companyId } });

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
    await prisma.purchaseBillLine.deleteMany({ where: { bill: { companyId } } });
    await prisma.purchaseBill.deleteMany({ where: { companyId } });
    await prisma.accountingPeriod.deleteMany({ where: { companyId } });
    await prisma.fiscalYear.deleteMany({ where: { companyId } });
    await prisma.account.deleteMany({ where: { companyId } });

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

  it("creates supplier payments, posts them, and exposes AP aging snapshots", async () => {
    const payment = await createSupplierPayment(ctx, {
      vendorId,
      paymentDate: new Date("2026-02-01"),
      paidAmountCents: 300,
      currency: "USD",
      paidFromAccountId,
      paidToAccountId,
      allocations: [
        {
          purchaseBillId,
          allocatedAmountCents: 300,
        },
      ],
    });

    await applySupplierPaymentAction(ctx, payment.id, { action: "SUBMIT" });
    const posted = await applySupplierPaymentAction(ctx, payment.id, { action: "POST" });

    expect(posted.status).toBe("POSTED");
    expect(posted.paymentEntryId).toBeTruthy();

    const listed = await listSupplierPayments(ctx, {
      page: 1,
      limit: 10,
      vendorId,
    });
    expect(listed.total).toBeGreaterThanOrEqual(1);
    expect(listed.rows.some((row) => row.id === payment.id)).toBe(true);

    const aging = await getPayablesAging(ctx, {
      asOfDate: new Date("2026-02-10"),
      vendorId,
      persistSnapshot: true,
      includeZeroBalance: false,
    });

    expect(aging.rows.length).toBeGreaterThan(0);
    expect(aging.summary.totalOutstandingCents).toBeGreaterThanOrEqual(0);

    const snapshots = await prisma.payableAgingSnapshot.findMany({
      where: { companyId, vendorId },
      select: { id: true },
    });
    expect(snapshots.length).toBeGreaterThan(0);
  });

  it("rejects invalid supplier payment payloads and posting without accounts", async () => {
    await expect(
      createSupplierPayment(ctx, {
        vendorId,
        paidAmountCents: 100,
        currency: "USD",
        allocations: [
          {
            purchaseBillId,
            allocatedAmountCents: 120,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const noAccounts = await createSupplierPayment(ctx, {
      vendorId,
      paidAmountCents: 50,
      currency: "USD",
      allocations: [],
    });

    await applySupplierPaymentAction(ctx, noAccounts.id, { action: "SUBMIT" });

    await expect(
      applySupplierPaymentAction(ctx, noAccounts.id, { action: "POST" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
