import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  applyPortalConfigAction,
  createPortalConfig,
} from "@/modules/portal/application/configs.service";
import { applyPosSaleAction, createPosSale } from "@/modules/pos/application/sales.service";
import { createPosProfile } from "@/modules/pos/application/profiles.service";
import { applyPosShiftAction, createPosShift } from "@/modules/pos/application/shifts.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("wave10 pos-portal integration", () => {
  const marker = `wave10-${Date.now()}`;
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
        name: "Wave10 POS Item",
        uom: "pcs",
        unitCostMinor: 100,
        priceCents: 500,
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
        name: "Wave10 Warehouse",
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

    await prisma.payment.deleteMany({ where: { companyId } });
    await prisma.salesInvoiceLine.deleteMany({ where: { invoice: { companyId } } });
    await prisma.salesInvoice.deleteMany({ where: { companyId } });

    await prisma.inventoryLedgerEntry.deleteMany({ where: { companyId } });
    await prisma.inventoryDocumentLine.deleteMany({ where: { companyId } });
    await prisma.inventoryWorkflowState.deleteMany({ where: { companyId } });
    await prisma.inventoryDocument.deleteMany({ where: { companyId } });
    await prisma.inventoryReservation.deleteMany({ where: { companyId } });
    await prisma.inventoryStockBalance.deleteMany({ where: { companyId } });
    await prisma.inventoryAuditLog.deleteMany({ where: { companyId } });
    await prisma.inventoryIdempotencyKey.deleteMany({ where: { companyId } });

    await prisma.posSalePayment.deleteMany({ where: { sale: { companyId } } });
    await prisma.posSaleLine.deleteMany({ where: { sale: { companyId } } });
    await prisma.posSale.deleteMany({ where: { companyId } });
    await prisma.posShift.deleteMany({ where: { companyId } });
    await prisma.posProfile.deleteMany({ where: { companyId } });

    await prisma.portalConfig.deleteMany({ where: { companyId } });
    await prisma.numberSeriesCounter.deleteMany({ where: { series: { companyId } } });
    await prisma.numberSeries.deleteMany({ where: { companyId } });

    await prisma.inventoryWarehouse.deleteMany({ where: { companyId } });
    await prisma.customer.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.brand.deleteMany({ where: { companyId } });
  });

  it("runs POS sale, stock deduction, shift close, and portal config lifecycle", async () => {
    const profile = await createPosProfile(ctx, {
      name: `${marker}-profile`,
      warehouseId,
    });

    const shift = await createPosShift(ctx, {
      number: `${marker}-SHIFT-001`,
      profileId: profile.id,
      openingCashMinor: 0,
    });

    const sale = await createPosSale(ctx, {
      profileId: profile.id,
      shiftId: shift.id,
      customerId,
      lines: [
        {
          productId,
          description: "Wave10 POS line",
          qty: 2,
          unitPriceMinor: 500,
        },
      ],
    });

    const paidSale = await applyPosSaleAction(ctx, sale.id, {
      action: "PAY",
      payments: [
        {
          method: "CASH",
          amountMinor: 1000,
        },
      ],
    });

    expect(paidSale.status).toBe("PAID");
    expect(paidSale.salesInvoiceId).toBeTruthy();

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

    const closedShift = await applyPosShiftAction(ctx, shift.id, {
      action: "CLOSE",
      closingCashMinor: 1000,
    });
    expect(closedShift.status).toBe("CLOSED");

    const portalConfig = await createPortalConfig(ctx, {
      partyType: "CUSTOMER",
      key: "default-portal-filter",
      filters: { status: "OPEN" },
      attributes: { showInvoices: true },
    });

    const inactiveConfig = await applyPortalConfigAction(ctx, portalConfig.id, {
      action: "DEACTIVATE",
    });

    expect(inactiveConfig.status).toBe("INACTIVE");
  });
});
