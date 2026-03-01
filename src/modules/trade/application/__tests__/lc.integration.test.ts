import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  approveLc,
  closeLc,
  createLc,
  createLcDiscrepancy,
  createLcDocset,
  createLcPayment,
  issueLc,
  markLcPaymentPaid,
  submitLc,
  waiveLcDiscrepancy,
} from "@/modules/trade/application/lc.service";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("trade lc integration", () => {
  const marker = `trade-lc-${Date.now()}`;
  const companyId = marker;
  const tenantId = marker;

  const makerCtx: PlatformRequestContext = {
    requestId: `${marker}-request-maker`,
    tenantId,
    companyId,
    userId: `${marker}-maker`,
    role: "OWNER",
    platformRole: "SUPER_ADMIN",
    permissions: [],
  };

  const approverCtx: PlatformRequestContext = {
    requestId: `${marker}-request-approver`,
    tenantId,
    companyId,
    userId: `${marker}-approver`,
    role: "OWNER",
    platformRole: "SUPER_ADMIN",
    permissions: [],
  };

  let vendorId = "";
  let bankId = "";

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    const vendor = await prisma.vendor.create({
      data: {
        companyId,
        name: `${marker}-vendor`,
      },
    });
    vendorId = vendor.id;

    const bank = await prisma.tradeLcBank.create({
      data: {
        tenantId,
        companyId,
        code: "ISSUER",
        name: "Issuer Bank",
        createdBy: makerCtx.userId,
        updatedBy: makerCtx.userId,
      },
    });
    bankId = bank.id;
  });

  afterAll(async () => {
    await prisma.tradeLcAttachment.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcEvent.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcDiscrepancy.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcDocumentLine.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcDocumentSet.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcCharge.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcPayment.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcAmendment.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcPoLink.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLc.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcSetting.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcBank.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcDocumentType.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcChargeType.deleteMany({ where: { companyId, tenantId } });
    await prisma.tradeLcIncoterm.deleteMany({ where: { companyId, tenantId } });
    await prisma.numberSeries.deleteMany({ where: { companyId, tenantId } });
    await prisma.vendor.deleteMany({ where: { companyId } });
  });

  it("creates, issues, processes docs, settles, and closes an LC", async () => {
    const created = await createLc(makerCtx, {
      beneficiaryVendorId: vendorId,
      issuingBankId: bankId,
      currency: "USD",
      lcAmount: 1000,
      expiryDate: new Date("2026-12-31T00:00:00.000Z"),
    });

    const lcId = created.lc.id as string;
    expect(created.lc.status).toBe("DRAFT");

    const submitted = await submitLc(makerCtx, lcId, created.lc.version as number);
    expect(submitted.lc.status).toBe("REQUESTED");

    const approved = await approveLc(approverCtx, lcId, submitted.lc.version as number);
    expect(approved.lc.status).toBe("APPROVED");

    const issued = await issueLc(approverCtx, lcId, approved.lc.version as number);
    expect(issued.lc.status).toBe("ISSUED");
    expect(issued.lc.lcNo).toBeTruthy();

    const docset = await createLcDocset(approverCtx, lcId, {
      shipmentRef: "BL-001",
    });
    expect(docset.status).toBeDefined();

    const discrepancy = await createLcDiscrepancy(approverCtx, lcId, {
      code: "DISC-001",
      title: "Invoice mismatch",
      description: "Invoice value mismatch",
      severity: "MEDIUM",
    });
    expect(discrepancy.decision).toBe("PENDING");

    const waived = await waiveLcDiscrepancy(approverCtx, discrepancy.id);
    expect(waived.decision).toBe("WAIVED");

    const payment = await createLcPayment(approverCtx, lcId, {
      paymentType: "SETTLEMENT",
      amount: 1000,
      currency: "USD",
      method: "BANK_TRANSFER",
      status: "INITIATED",
      paymentDate: new Date("2026-02-01T00:00:00.000Z"),
    });
    expect(payment.status).toBe("INITIATED");

    const paid = await markLcPaymentPaid(approverCtx, payment.id, {});
    expect(paid.status).toBe("PAID");

    const closed = await closeLc(approverCtx, lcId);
    expect(closed.lc.status).toBe("CLOSED");
  });
});
