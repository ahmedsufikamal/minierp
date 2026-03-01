import {
  Prisma,
  type TradeLc,
  type TradeLcAmendmentStatus,
  type TradeLcDiscrepancyDecision,
  type TradeLcDocumentSetStatus,
  type TradeLcEventType,
  type TradeLcStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createDownloadUrl, createUploadUrl } from "@/modules/inventory/infrastructure/storage";
import {
  appendAuditEvent,
  appendImmutableLedgerEvent,
  enqueueOutboxEvent,
} from "@/modules/platform/application/audit-ledger.service";
import { listMasterCurrencies } from "@/modules/platform/application/master-reference.service";
import { allocateSeriesNumber } from "@/modules/platform/application/numbering.service";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { ensureTradeLcDefaults } from "@/modules/trade/application/lc-seeding.service";
import { hasTradePermission, tradeLcOpenStatuses, tradeLcPostIssueStatuses, tradePermissions } from "@/modules/trade/domain/types";

type TradeTx = Prisma.TransactionClient;

type LcListInput = {
  cursor?: string;
  limit: number;
  query?: string;
  status?: string;
  bank?: string;
  supplier?: string;
  currency?: string;
  from?: Date;
  to?: Date;
};

type WorklistInput = {
  cursor?: string;
  limit: number;
  status?: string;
  lcId?: string;
};

const openStatusSet = new Set<string>(tradeLcOpenStatuses);
const postIssueStatusSet = new Set<string>(tradeLcPostIssueStatuses);

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
  return value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function toDecimal(value: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(value ?? 0);
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number(value.toString());
}

function isFutureOpenStatus(status: string): boolean {
  return openStatusSet.has(status);
}

export function resolveEffectiveLcStatus(
  status: TradeLcStatus,
  expiryDate: Date,
  now = new Date(),
): TradeLcStatus {
  if (status === "CLOSED" || status === "CANCELLED" || status === "EXPIRED") {
    return status;
  }
  if (expiryDate < now && isFutureOpenStatus(status)) {
    return "EXPIRED";
  }
  return status;
}

export function canApproveWithDualControl(input: {
  dualControlEnabled: boolean;
  createdBy: string | null;
  actorUserId: string;
}): boolean {
  if (!input.dualControlEnabled) return true;
  if (!input.createdBy) return true;
  return input.createdBy !== input.actorUserId;
}

export function getDiscrepancyDrivenStatus(
  decisions: TradeLcDiscrepancyDecision[],
): TradeLcStatus | null {
  if (decisions.length === 0) return null;
  const allResolved = decisions.every((decision) => decision === "WAIVED" || decision === "ACCEPTED");
  return allResolved ? "ACCEPTED" : "DISCREPANT";
}

export function canVerifyDocumentChecklist(
  lines: Array<{ required: boolean; received: boolean }>,
): boolean {
  return lines.every((line) => !line.required || line.received);
}

export function canTransitionLcStatus(status: TradeLcStatus, action: "SUBMIT" | "APPROVE" | "ISSUE" | "CANCEL" | "CLOSE") {
  switch (action) {
    case "SUBMIT":
      return status === "DRAFT";
    case "APPROVE":
      return status === "REQUESTED";
    case "ISSUE":
      return status === "APPROVED";
    case "CANCEL":
      return status === "DRAFT" || status === "REQUESTED" || status === "APPROVED";
    case "CLOSE":
      return status === "ACCEPTED" || status === "SETTLED";
    default:
      return false;
  }
}

async function appendTradeLcEventTx(
  tx: TradeTx,
  ctx: PlatformRequestContext,
  lcId: string,
  eventType: TradeLcEventType,
  message: string,
  dataJson?: Record<string, unknown>,
) {
  await tx.tradeLcEvent.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId,
      eventType,
      message,
      dataJson: dataJson ? (dataJson as Prisma.InputJsonValue) : Prisma.JsonNull,
      actorUserId: ctx.userId,
    },
  });
}

export async function appendTradeLcEvent(
  ctx: PlatformRequestContext,
  lcId: string,
  eventType: TradeLcEventType,
  message: string,
  dataJson?: Record<string, unknown>,
) {
  await prisma.tradeLcEvent.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId,
      eventType,
      message,
      dataJson: dataJson ? (dataJson as Prisma.InputJsonValue) : Prisma.JsonNull,
      actorUserId: ctx.userId,
    },
  });
}

async function writeTradeAudit(
  ctx: PlatformRequestContext,
  input: {
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
    source?: string;
  },
) {
  await appendAuditEvent(ctx, {
    source: input.source ?? "trade.lc",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    before: input.before,
    after: input.after,
  });
}

async function writeTradeLedger(
  ctx: PlatformRequestContext,
  lcId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  await appendImmutableLedgerEvent(ctx, {
    stream: "trade.lc",
    eventType,
    entityType: "TradeLc",
    entityId: lcId,
    payload,
  });
  await enqueueOutboxEvent(ctx, {
    topic: "trade.lc.events",
    aggregateType: "TradeLc",
    aggregateId: lcId,
    payload: {
      eventType,
      ...payload,
    },
  });
}

async function requireScopedLc(
  tx: typeof prisma | TradeTx,
  ctx: PlatformRequestContext,
  id: string,
) {
  const lc = await tx.tradeLc.findFirst({
    where: {
      id,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    include: {
      beneficiaryVendor: {
        select: { id: true, name: true, email: true, phone: true },
      },
      issuingBank: {
        select: { id: true, code: true, name: true, swift: true, country: true },
      },
      advisingBank: {
        select: { id: true, code: true, name: true, swift: true, country: true },
      },
      confirmingBank: {
        select: { id: true, code: true, name: true, swift: true, country: true },
      },
      poLinks: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!lc) {
    throw new PlatformError("NOT_FOUND", "LC not found");
  }

  return lc;
}

async function ensureVendorAndBanks(
  tx: typeof prisma | TradeTx,
  ctx: PlatformRequestContext,
  input: {
    beneficiaryVendorId?: string;
    issuingBankId?: string;
    advisingBankId?: string | null;
    confirmingBankId?: string | null;
  },
) {
  if (input.beneficiaryVendorId) {
    const vendor = await tx.vendor.findFirst({
      where: { id: input.beneficiaryVendorId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!vendor) {
      throw new PlatformError("VALIDATION_ERROR", "Beneficiary vendor not found in the active company");
    }
  }

  const bankIds = [
    input.issuingBankId ? { label: "issuing", id: input.issuingBankId } : null,
    input.advisingBankId ? { label: "advising", id: input.advisingBankId } : null,
    input.confirmingBankId ? { label: "confirming", id: input.confirmingBankId } : null,
  ].filter(Boolean) as Array<{ label: string; id: string }>;

  for (const bank of bankIds) {
    const exists = await tx.tradeLcBank.findFirst({
      where: {
        id: bank.id,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
      select: { id: true },
    });
    if (!exists) {
      throw new PlatformError("VALIDATION_ERROR", `${bank.label} bank not found in the active workspace`);
    }
  }
}

async function validatePurchaseOrders(
  tx: typeof prisma | TradeTx,
  ctx: PlatformRequestContext,
  links: Array<{ purchaseOrderId: string }>,
) {
  for (const link of links) {
    const order = await tx.purchaseOrder.findFirst({
      where: {
        id: link.purchaseOrderId,
        companyId: ctx.companyId,
      },
      select: { id: true },
    });
    if (!order) {
      throw new PlatformError("VALIDATION_ERROR", `Purchase order ${link.purchaseOrderId} not found`);
    }
  }
}

async function getSettlementPaidByLcIds(
  ctx: PlatformRequestContext,
  lcIds: string[],
) {
  if (lcIds.length === 0) return new Map<string, Prisma.Decimal>();

  const grouped = await prisma.tradeLcPayment.groupBy({
    by: ["lcId"],
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId: { in: lcIds },
      paymentType: "SETTLEMENT",
      status: "PAID",
    },
    _sum: {
      amount: true,
    },
  });

  return new Map(grouped.map((row) => [row.lcId, row._sum.amount ?? new Prisma.Decimal(0)]));
}

async function getChargeTotalByLcIds(ctx: PlatformRequestContext, lcIds: string[]) {
  if (lcIds.length === 0) return new Map<string, Prisma.Decimal>();

  const grouped = await prisma.tradeLcCharge.groupBy({
    by: ["lcId"],
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId: { in: lcIds },
    },
    _sum: {
      amount: true,
    },
  });

  return new Map(grouped.map((row) => [row.lcId, row._sum.amount ?? new Prisma.Decimal(0)]));
}

async function getPendingDiscrepancyCountByLcIds(ctx: PlatformRequestContext, lcIds: string[]) {
  if (lcIds.length === 0) return new Map<string, number>();

  const grouped = await prisma.tradeLcDiscrepancy.groupBy({
    by: ["lcId"],
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId: { in: lcIds },
      decision: { in: ["PENDING", "REJECTED"] },
    },
    _count: {
      lcId: true,
    },
  });

  return new Map(grouped.map((row) => [row.lcId, row._count.lcId]));
}

async function getPendingDocumentSetCountByLcIds(ctx: PlatformRequestContext, lcIds: string[]) {
  if (lcIds.length === 0) return new Map<string, number>();

  const grouped = await prisma.tradeLcDocumentSet.groupBy({
    by: ["lcId"],
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId: { in: lcIds },
      status: { in: ["PENDING", "RECEIVED"] },
    },
    _count: {
      lcId: true,
    },
  });

  return new Map(grouped.map((row) => [row.lcId, row._count.lcId]));
}

async function ensureSettlementSync(tx: TradeTx, ctx: PlatformRequestContext, lcId: string) {
  const lc = await tx.tradeLc.findFirst({
    where: {
      id: lcId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    select: {
      id: true,
      lcAmount: true,
      status: true,
      version: true,
      expiryDate: true,
    },
  });

  if (!lc) {
    throw new PlatformError("NOT_FOUND", "LC not found");
  }

  const paidRows = await tx.tradeLcPayment.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId,
      paymentType: "SETTLEMENT",
      status: "PAID",
    },
    select: { amount: true },
  });
  const paid = paidRows.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));

  const openDiscrepancies = await tx.tradeLcDiscrepancy.count({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId,
      decision: { in: ["PENDING", "REJECTED"] },
    },
  });

  if (
    openDiscrepancies === 0 &&
    paid.greaterThanOrEqualTo(lc.lcAmount) &&
    lc.status !== "SETTLED" &&
    lc.status !== "CLOSED" &&
    lc.status !== "CANCELLED"
  ) {
    await tx.tradeLc.update({
      where: { id: lcId },
      data: {
        status: "SETTLED",
        version: { increment: 1 },
        updatedBy: ctx.userId,
      },
    });
    await appendTradeLcEventTx(tx, ctx, lcId, "SETTLED", "LC reached full settlement", {
      paidSettlement: paid.toString(),
    });
    return "SETTLED" as const;
  }

  return null;
}

async function resolveDiscrepancyDrivenStatus(tx: TradeTx, ctx: PlatformRequestContext, lcId: string) {
  const decisions = await tx.tradeLcDiscrepancy.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId,
    },
    select: { decision: true },
  });

  return getDiscrepancyDrivenStatus(decisions.map((item) => item.decision));
}

function serializeLcRow(
  lc: any,
  input: {
    settlementPaid?: Prisma.Decimal;
    chargeTotal?: Prisma.Decimal;
    pendingDiscrepancies?: number;
    pendingDocumentSets?: number;
  } = {},
) {
  const effectiveStatus = resolveEffectiveLcStatus(lc.status, lc.expiryDate);
  const settlementPaid = input.settlementPaid ?? new Prisma.Decimal(0);
  const chargeTotal = input.chargeTotal ?? new Prisma.Decimal(0);
  const pendingDiscrepancies = input.pendingDiscrepancies ?? 0;
  const pendingDocumentSets = input.pendingDocumentSets ?? 0;
  const outstandingAmount = Prisma.Decimal.max(new Prisma.Decimal(0), lc.lcAmount.sub(settlementPaid));

  return {
    id: lc.id,
    lcNo: lc.lcNo,
    displayLcNo: lc.lcNo ?? "Draft LC",
    lcType: lc.lcType,
    status: effectiveStatus,
    storedStatus: lc.status,
    applicantPartyId: lc.companyId,
    beneficiaryPartyId: lc.beneficiaryVendorId,
    beneficiaryVendorId: lc.beneficiaryVendorId,
    beneficiaryName: lc.beneficiaryVendor.name,
    issuingBankId: lc.issuingBankId,
    issuingBankName: lc.issuingBank.name,
    advisingBankId: lc.advisingBankId,
    advisingBankName: lc.advisingBank?.name ?? null,
    confirmingBankId: lc.confirmingBankId,
    confirmingBankName: lc.confirmingBank?.name ?? null,
    currency: lc.currency,
    lcAmount: toNumber(lc.lcAmount),
    tolerancePercent: lc.tolerancePercent ? toNumber(lc.tolerancePercent) : null,
    issueDate: lc.issueDate,
    maturityDate: lc.maturityDate,
    latestShipmentDate: lc.latestShipmentDate,
    expiryDate: lc.expiryDate,
    placeOfExpiry: lc.placeOfExpiry,
    shipmentFrom: lc.shipmentFrom,
    shipmentTo: lc.shipmentTo,
    portOfLoading: lc.portOfLoading,
    portOfDischarge: lc.portOfDischarge,
    partialShipmentAllowed: lc.partialShipmentAllowed,
    transshipmentAllowed: lc.transshipmentAllowed,
    marginPercent: lc.marginPercent ? toNumber(lc.marginPercent) : null,
    marginAmount: lc.marginAmount ? toNumber(lc.marginAmount) : null,
    lienReference: lc.lienReference,
    incotermCode: lc.incotermCode,
    remarks: lc.remarks,
    termsText: lc.termsText,
    version: lc.version,
    poLinks: (lc.poLinks ?? []).map((link: any) => ({
      id: link.id,
      purchaseOrderId: link.purchaseOrderId,
      coveredAmount: toNumber(link.coveredAmount),
      coveredCurrency: link.coveredCurrency,
      externalReference: link.externalReference,
    })),
    chargeTotal: toNumber(chargeTotal),
    settlementPaid: toNumber(settlementPaid),
    outstandingAmount: toNumber(outstandingAmount),
    pendingDiscrepancies,
    pendingDocumentSets,
    createdBy: lc.createdBy,
    updatedBy: lc.updatedBy,
    createdAt: lc.createdAt,
    updatedAt: lc.updatedAt,
  };
}

async function buildLcActionFlags(
  ctx: PlatformRequestContext,
  lc: Awaited<ReturnType<typeof requireScopedLc>>,
  pendingDiscrepancies: number,
  settlementPaid: Prisma.Decimal,
) {
  const settings = await prisma.tradeLcSetting.findUnique({
    where: {
      tenantId_companyId: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
    },
  });

  const fullyPaid = settlementPaid.greaterThanOrEqualTo(lc.lcAmount);

  return {
    canEdit: lc.status === "DRAFT" && hasTradePermission(ctx, tradePermissions.lcWrite),
    canSubmit:
      lc.status === "DRAFT" && hasTradePermission(ctx, tradePermissions.lcWrite),
    canApprove:
      lc.status === "REQUESTED" &&
      hasTradePermission(ctx, tradePermissions.lcApprove) &&
      canApproveWithDualControl({
        dualControlEnabled: settings?.dualControlEnabled ?? true,
        createdBy: lc.createdBy ?? null,
        actorUserId: ctx.userId,
      }),
    canIssue:
      lc.status === "APPROVED" && hasTradePermission(ctx, tradePermissions.lcIssue),
    canCancel:
      (lc.status === "DRAFT" || lc.status === "REQUESTED" || lc.status === "APPROVED") &&
      hasTradePermission(ctx, tradePermissions.lcIssue),
    canClose:
      (lc.status === "ACCEPTED" || lc.status === "SETTLED") &&
      pendingDiscrepancies === 0 &&
      fullyPaid &&
      hasTradePermission(ctx, tradePermissions.lcSettle),
  };
}

export async function getLcDashboard(ctx: PlatformRequestContext) {
  await ensureTradeLcDefaults(ctx);

  const settings =
    (await prisma.tradeLcSetting.findUnique({
      where: {
        tenantId_companyId: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
        },
      },
    })) ??
    (await prisma.tradeLcSetting.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    }));

  const now = new Date();
  const expiringBy = new Date(now);
  expiringBy.setUTCDate(expiringBy.getUTCDate() + settings.expiringSoonDays);
  const maturityBy = new Date(now);
  maturityBy.setUTCDate(maturityBy.getUTCDate() + settings.maturitySoonDays);

  const openCount = await prisma.tradeLc.count({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      status: { in: Array.from(openStatusSet) as TradeLcStatus[] },
    },
  });

  const expiringSoonCount = await prisma.tradeLc.count({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      status: { in: Array.from(openStatusSet) as TradeLcStatus[] },
      expiryDate: { gte: now, lte: expiringBy },
    },
  });

  const discrepantCount = await prisma.tradeLc.count({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      status: "DISCREPANT",
    },
  });

  const openIssued = await prisma.tradeLc.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      status: { in: ["ISSUED", "ACTIVE", "DOCS_RECEIVED", "UNDER_SCRUTINY", "DISCREPANT", "ACCEPTED", "SETTLED"] },
    },
    select: { id: true, lcAmount: true },
  });

  const settlementMap = await getSettlementPaidByLcIds(
    ctx,
    openIssued.map((item) => item.id),
  );
  const outstandingAmount = openIssued.reduce((sum, lc) => {
    const paid = settlementMap.get(lc.id) ?? new Prisma.Decimal(0);
    const balance = Prisma.Decimal.max(new Prisma.Decimal(0), lc.lcAmount.sub(paid));
    return sum.add(balance);
  }, new Prisma.Decimal(0));

  const expiringSoon = await prisma.tradeLc.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      status: { in: Array.from(openStatusSet) as TradeLcStatus[] },
      expiryDate: { gte: now, lte: expiringBy },
    },
    include: {
      beneficiaryVendor: { select: { name: true } },
      issuingBank: { select: { name: true } },
      poLinks: true,
      advisingBank: { select: { name: true, code: true, id: true, swift: true, country: true } },
      confirmingBank: { select: { name: true, code: true, id: true, swift: true, country: true } },
    },
    orderBy: { expiryDate: "asc" },
    take: 5,
  });

  const documentsPending = await prisma.tradeLcDocumentSet.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      status: { in: ["PENDING", "RECEIVED"] as TradeLcDocumentSetStatus[] },
    },
    include: {
      lc: {
        include: {
          beneficiaryVendor: { select: { name: true } },
          issuingBank: { select: { name: true } },
          poLinks: true,
          advisingBank: { select: { name: true, code: true, id: true, swift: true, country: true } },
          confirmingBank: { select: { name: true, code: true, id: true, swift: true, country: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const maturityUpcoming = await prisma.tradeLc.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      status: { in: ["ISSUED", "ACTIVE", "DOCS_RECEIVED", "UNDER_SCRUTINY", "DISCREPANT", "ACCEPTED", "SETTLED"] },
      maturityDate: { not: null, gte: now, lte: maturityBy },
    },
    include: {
      beneficiaryVendor: { select: { name: true } },
      issuingBank: { select: { name: true } },
      poLinks: true,
      advisingBank: { select: { name: true, code: true, id: true, swift: true, country: true } },
      confirmingBank: { select: { name: true, code: true, id: true, swift: true, country: true } },
    },
    orderBy: { maturityDate: "asc" },
    take: 5,
  });

  return {
    kpis: {
      openLcs: openCount,
      expiringSoon: expiringSoonCount,
      discrepant: discrepantCount,
      outstandingAmount: toNumber(outstandingAmount),
    },
    expiringSoon: expiringSoon.map((lc) => serializeLcRow(lc)),
    documentsPending: documentsPending.map((docset) => ({
      id: docset.id,
      lcId: docset.lcId,
      lcNo: docset.lc.lcNo ?? "Draft LC",
      supplier: docset.lc.beneficiaryVendor.name,
      shipmentRef: docset.shipmentRef,
      status: docset.status,
      docsReceivedDate: docset.docsReceivedDate,
      updatedAt: docset.updatedAt,
    })),
    maturityUpcoming: maturityUpcoming.map((lc) => serializeLcRow(lc)),
    settings: {
      dualControlEnabled: settings.dualControlEnabled,
      expiringSoonDays: settings.expiringSoonDays,
      maturitySoonDays: settings.maturitySoonDays,
    },
  };
}

function buildLcWhere(ctx: PlatformRequestContext, input: LcListInput): Prisma.TradeLcWhereInput {
  const where: Prisma.TradeLcWhereInput = {
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
  };

  if (input.query) {
    where.OR = [
      { lcNo: { contains: input.query, mode: "insensitive" } },
      { beneficiaryVendor: { name: { contains: input.query, mode: "insensitive" } } },
      { issuingBank: { name: { contains: input.query, mode: "insensitive" } } },
    ];
  }

  if (input.status) {
    if (input.status === "EXPIRED") {
      where.status = { in: Array.from(openStatusSet) as TradeLcStatus[] };
      where.expiryDate = { lt: new Date() };
    } else {
      where.status = input.status as TradeLcStatus;
    }
  }

  if (input.bank) {
    where.issuingBankId = input.bank;
  }
  if (input.supplier) {
    where.beneficiaryVendorId = input.supplier;
  }
  if (input.currency) {
    where.currency = input.currency;
  }
  if (input.from || input.to) {
    where.createdAt = {
      ...(input.from ? { gte: input.from } : {}),
      ...(input.to ? { lte: input.to } : {}),
    };
  }

  return where;
}

export async function listLcs(ctx: PlatformRequestContext, input: LcListInput) {
  await ensureTradeLcDefaults(ctx);
  const where = buildLcWhere(ctx, input);

  const rows = await prisma.tradeLc.findMany({
    where,
    include: {
      beneficiaryVendor: { select: { id: true, name: true, email: true, phone: true } },
      issuingBank: { select: { id: true, code: true, name: true, swift: true, country: true } },
      advisingBank: { select: { id: true, code: true, name: true, swift: true, country: true } },
      confirmingBank: { select: { id: true, code: true, name: true, swift: true, country: true } },
      poLinks: true,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const pageRows = rows.slice(0, input.limit);
  const lcIds = pageRows.map((row) => row.id);
  const [settlementMap, chargeMap, discrepancyMap, docsetMap] = await Promise.all([
    getSettlementPaidByLcIds(ctx, lcIds),
    getChargeTotalByLcIds(ctx, lcIds),
    getPendingDiscrepancyCountByLcIds(ctx, lcIds),
    getPendingDocumentSetCountByLcIds(ctx, lcIds),
  ]);

  return {
    rows: pageRows.map((row) =>
      serializeLcRow(row, {
        settlementPaid: settlementMap.get(row.id),
        chargeTotal: chargeMap.get(row.id),
        pendingDiscrepancies: discrepancyMap.get(row.id) ?? 0,
        pendingDocumentSets: docsetMap.get(row.id) ?? 0,
      }),
    ),
    total: await prisma.tradeLc.count({ where }),
    nextCursor: rows.length > input.limit ? rows[input.limit]?.id ?? null : null,
  };
}

export async function getLcFormOptions(ctx: PlatformRequestContext) {
  await ensureTradeLcDefaults(ctx);

  const [vendors, banks, incoterms, documentTypes, purchaseOrders, settings] = await Promise.all([
    prisma.vendor.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { name: "asc" },
      take: 100,
      select: { id: true, name: true, email: true },
    }),
    prisma.tradeLcBank.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId, isActive: true },
      orderBy: [{ name: "asc" }],
    }),
    prisma.tradeLcIncoterm.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId, isActive: true },
      orderBy: [{ code: "asc" }],
    }),
    prisma.tradeLcDocumentType.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
    prisma.purchaseOrder.findMany({
      where: {
        companyId: ctx.companyId,
        status: { not: "CANCELLED" },
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { orderDate: "desc" },
      take: 50,
    }),
    prisma.tradeLcSetting.findUnique({
      where: {
        tenantId_companyId: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
        },
      },
    }),
  ]);

  let currencies: Awaited<ReturnType<typeof listMasterCurrencies>> = [];
  try {
    currencies = await listMasterCurrencies(ctx);
  } catch {
    currencies = [];
  }

  return {
    vendors,
    banks,
    incoterms,
    documentTypes,
    currencies,
    purchaseOrders: purchaseOrders.map((row) => ({
      id: row.id,
      number: row.number,
      vendorId: row.vendorId,
      vendorName: row.vendor.name,
      status: row.status,
      orderDate: row.orderDate,
    })),
    settings,
  };
}

type LcMutationInput = {
  lcType?: "IMPORT" | "EXPORT";
  beneficiaryVendorId?: string;
  issuingBankId?: string;
  advisingBankId?: string;
  confirmingBankId?: string;
  currency?: string;
  lcAmount?: number;
  tolerancePercent?: number;
  issueDate?: Date;
  maturityDate?: Date;
  latestShipmentDate?: Date;
  expiryDate?: Date;
  placeOfExpiry?: string;
  shipmentFrom?: string;
  shipmentTo?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  partialShipmentAllowed?: boolean;
  transshipmentAllowed?: boolean;
  marginPercent?: number;
  marginAmount?: number;
  lienReference?: string;
  incotermCode?: string;
  remarks?: string;
  termsText?: string;
  linkedPurchaseOrders?: Array<{
    purchaseOrderId: string;
    coveredAmount: number;
    coveredCurrency: string;
    externalReference?: string;
  }>;
  version?: number;
};

function normalizeLcData(input: LcMutationInput) {
  return {
    lcType: input.lcType,
    beneficiaryVendorId: input.beneficiaryVendorId,
    issuingBankId: input.issuingBankId,
    advisingBankId: input.advisingBankId || null,
    confirmingBankId: input.confirmingBankId || null,
    currency: input.currency,
    lcAmount: input.lcAmount === undefined ? undefined : toDecimal(input.lcAmount),
    tolerancePercent: input.tolerancePercent === undefined ? undefined : toDecimal(input.tolerancePercent),
    issueDate: input.issueDate,
    maturityDate: input.maturityDate,
    latestShipmentDate: input.latestShipmentDate,
    expiryDate: input.expiryDate,
    placeOfExpiry: input.placeOfExpiry,
    shipmentFrom: input.shipmentFrom,
    shipmentTo: input.shipmentTo,
    portOfLoading: input.portOfLoading,
    portOfDischarge: input.portOfDischarge,
    partialShipmentAllowed: input.partialShipmentAllowed,
    transshipmentAllowed: input.transshipmentAllowed,
    marginPercent: input.marginPercent === undefined ? undefined : toDecimal(input.marginPercent),
    marginAmount: input.marginAmount === undefined ? undefined : toDecimal(input.marginAmount),
    lienReference: input.lienReference,
    incotermCode: input.incotermCode || null,
    remarks: input.remarks,
    termsText: input.termsText,
  };
}

export async function createLc(ctx: PlatformRequestContext, input: LcMutationInput) {
  await ensureTradeLcDefaults(ctx);
  if (!input.beneficiaryVendorId || !input.issuingBankId || !input.currency || input.lcAmount === undefined || !input.expiryDate) {
    throw new PlatformError("VALIDATION_ERROR", "beneficiaryVendorId, issuingBankId, currency, lcAmount, and expiryDate are required");
  }
  const beneficiaryVendorId = input.beneficiaryVendorId;
  const issuingBankId = input.issuingBankId;
  const currency = input.currency;
  const lcAmount = input.lcAmount;
  const expiryDate = input.expiryDate;
  await ensureVendorAndBanks(prisma, ctx, {
    beneficiaryVendorId,
    issuingBankId,
    advisingBankId: input.advisingBankId,
    confirmingBankId: input.confirmingBankId,
  });
  await validatePurchaseOrders(prisma, ctx, input.linkedPurchaseOrders ?? []);

  const created = await prisma.$transaction(async (tx) => {
    const lc = await tx.tradeLc.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        status: "DRAFT",
        lcType: input.lcType ?? "IMPORT",
        beneficiaryVendorId,
        issuingBankId,
        advisingBankId: input.advisingBankId ?? null,
        confirmingBankId: input.confirmingBankId ?? null,
        currency,
        lcAmount: toDecimal(lcAmount),
        tolerancePercent: input.tolerancePercent === undefined ? undefined : toDecimal(input.tolerancePercent),
        issueDate: input.issueDate,
        maturityDate: input.maturityDate,
        latestShipmentDate: input.latestShipmentDate,
        expiryDate,
        placeOfExpiry: input.placeOfExpiry ?? null,
        shipmentFrom: input.shipmentFrom ?? null,
        shipmentTo: input.shipmentTo ?? null,
        portOfLoading: input.portOfLoading ?? null,
        portOfDischarge: input.portOfDischarge ?? null,
        partialShipmentAllowed: input.partialShipmentAllowed ?? false,
        transshipmentAllowed: input.transshipmentAllowed ?? false,
        marginPercent: input.marginPercent === undefined ? undefined : toDecimal(input.marginPercent),
        marginAmount: input.marginAmount === undefined ? undefined : toDecimal(input.marginAmount),
        lienReference: input.lienReference ?? null,
        incotermCode: input.incotermCode ?? null,
        remarks: input.remarks ?? null,
        termsText: input.termsText ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });

    if ((input.linkedPurchaseOrders ?? []).length > 0) {
      await tx.tradeLcPoLink.createMany({
        data: (input.linkedPurchaseOrders ?? []).map((link) => ({
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          lcId: lc.id,
          purchaseOrderId: link.purchaseOrderId,
          coveredAmount: toDecimal(link.coveredAmount),
          coveredCurrency: link.coveredCurrency,
          externalReference: link.externalReference ?? null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })),
      });
    }

    await appendTradeLcEventTx(tx, ctx, lc.id, "CREATED", "LC draft created");
    return lc;
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.created",
    entityType: "TradeLc",
    entityId: created.id,
    after: { status: created.status, beneficiaryVendorId: created.beneficiaryVendorId },
  });

  return getLcDetail(ctx, created.id);
}

export async function updateLc(ctx: PlatformRequestContext, id: string, input: LcMutationInput) {
  await ensureTradeLcDefaults(ctx);

  const current = await requireScopedLc(prisma, ctx, id);
  if (current.status !== "DRAFT") {
    throw new PlatformError("CONFLICT", "Only DRAFT LCs can be edited");
  }
  if (input.version && input.version !== current.version) {
    throw new PlatformError("CONFLICT", "LC has been modified by another user");
  }

  await ensureVendorAndBanks(prisma, ctx, {
    beneficiaryVendorId: input.beneficiaryVendorId ?? current.beneficiaryVendorId,
    issuingBankId: input.issuingBankId ?? current.issuingBankId,
    advisingBankId: input.advisingBankId ?? current.advisingBankId ?? undefined,
    confirmingBankId: input.confirmingBankId ?? current.confirmingBankId ?? undefined,
  });
  await validatePurchaseOrders(prisma, ctx, input.linkedPurchaseOrders ?? []);

  await prisma.$transaction(async (tx) => {
    const result = await tx.tradeLc.updateMany({
      where: {
        id,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        version: input.version ?? current.version,
      },
      data: {
        ...normalizeLcData(input),
        version: { increment: 1 },
        updatedBy: ctx.userId,
      },
    });

    if (result.count === 0) {
      throw new PlatformError("CONFLICT", "LC has been modified by another user");
    }

    if (input.linkedPurchaseOrders) {
      await tx.tradeLcPoLink.deleteMany({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          lcId: id,
        },
      });
      if (input.linkedPurchaseOrders.length > 0) {
        await tx.tradeLcPoLink.createMany({
          data: input.linkedPurchaseOrders.map((link) => ({
            tenantId: ctx.tenantId,
            companyId: ctx.companyId,
            lcId: id,
            purchaseOrderId: link.purchaseOrderId,
            coveredAmount: toDecimal(link.coveredAmount),
            coveredCurrency: link.coveredCurrency,
            externalReference: link.externalReference ?? null,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })),
        });
      }
    }

    await appendTradeLcEventTx(tx, ctx, id, "UPDATED", "LC draft updated");
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.updated",
    entityType: "TradeLc",
    entityId: id,
    before: { version: current.version },
    after: { version: current.version + 1 },
  });

  return getLcDetail(ctx, id);
}

export async function getLcDetail(ctx: PlatformRequestContext, id: string) {
  await ensureTradeLcDefaults(ctx);
  const lc = await requireScopedLc(prisma, ctx, id);
  const [settlementMap, chargeMap, discrepancyMap, docsetMap, timeline] = await Promise.all([
    getSettlementPaidByLcIds(ctx, [id]),
    getChargeTotalByLcIds(ctx, [id]),
    getPendingDiscrepancyCountByLcIds(ctx, [id]),
    getPendingDocumentSetCountByLcIds(ctx, [id]),
    prisma.tradeLcEvent.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        lcId: id,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const settlementPaid = settlementMap.get(id) ?? new Prisma.Decimal(0);
  const pendingDiscrepancies = discrepancyMap.get(id) ?? 0;

  return {
    lc: serializeLcRow(lc, {
      settlementPaid,
      chargeTotal: chargeMap.get(id),
      pendingDiscrepancies,
      pendingDocumentSets: docsetMap.get(id) ?? 0,
    }),
    actions: await buildLcActionFlags(ctx, lc, pendingDiscrepancies, settlementPaid),
    timeline: timeline.map((item) => ({
      id: item.id,
      eventType: item.eventType,
      message: item.message,
      dataJson: item.dataJson,
      actorUserId: item.actorUserId,
      createdAt: item.createdAt,
    })),
  };
}

async function applyLcAction(
  ctx: PlatformRequestContext,
  id: string,
  action: "SUBMIT" | "APPROVE" | "ISSUE" | "CANCEL" | "CLOSE",
  version?: number,
) {
  await ensureTradeLcDefaults(ctx);
  const current = await requireScopedLc(prisma, ctx, id);
  if (!canTransitionLcStatus(current.status, action)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} LC from ${current.status}`);
  }
  if (version && version !== current.version) {
    throw new PlatformError("CONFLICT", "LC has been modified by another user");
  }

  const settings = await prisma.tradeLcSetting.findUnique({
    where: {
      tenantId_companyId: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
    },
  });

  const updated = await prisma.$transaction(async (tx) => {
    let nextStatus: TradeLcStatus = current.status;
    const nextData: Prisma.TradeLcUpdateManyMutationInput = {
      version: { increment: 1 },
      updatedBy: ctx.userId,
    };
    let eventType: TradeLcEventType = "UPDATED";
    let eventMessage = "";
    let auditPayload: Record<string, unknown> = {};

    if (action === "SUBMIT") {
      nextStatus = "REQUESTED";
      eventType = "SUBMITTED";
      eventMessage = "LC submitted for approval";
    }

    if (action === "APPROVE") {
      if (
        !canApproveWithDualControl({
          dualControlEnabled: settings?.dualControlEnabled ?? true,
          createdBy: current.createdBy ?? null,
          actorUserId: ctx.userId,
        })
      ) {
        throw new PlatformError("FORBIDDEN", "Dual control is enabled. A different user must approve this LC");
      }
      nextStatus = "APPROVED";
      eventType = "APPROVED";
      eventMessage = "LC approved";
    }

    if (action === "ISSUE") {
      const issueDate = current.issueDate ?? new Date();
      if (current.expiryDate < issueDate) {
        throw new PlatformError("VALIDATION_ERROR", "expiry_date must be on or after issue_date");
      }

      let lcNo = current.lcNo;
      if (!lcNo) {
        const fiscalYear = String(issueDate.getUTCFullYear());
        const allocated = await allocateSeriesNumber(ctx, {
          key: "TRADE_LC",
          strictCompanyScope: true,
          fiscalYear,
          date: issueDate,
        });
        lcNo = allocated.number;
      }

      nextStatus = "ISSUED";
      nextData.issueDate = issueDate;
      nextData.lcNo = lcNo;
      eventType = "ISSUED";
      eventMessage = "LC issued";
      auditPayload = { lcNo };
    }

    if (action === "CANCEL") {
      nextStatus = "CANCELLED";
      eventType = "CANCELLED";
      eventMessage = "LC cancelled";
    }

    if (action === "CLOSE") {
      const paidRows = await tx.tradeLcPayment.findMany({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          lcId: id,
          paymentType: "SETTLEMENT",
          status: "PAID",
        },
        select: { amount: true },
      });
      const paid = paidRows.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
      const openDiscrepancies = await tx.tradeLcDiscrepancy.count({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          lcId: id,
          decision: { in: ["PENDING", "REJECTED"] },
        },
      });

      if (openDiscrepancies > 0) {
        throw new PlatformError("CONFLICT", "Resolve all discrepancies before closing the LC");
      }
      if (paid.lessThan(current.lcAmount)) {
        throw new PlatformError("CONFLICT", "Full settlement is required before closing the LC");
      }

      if (current.status !== "SETTLED") {
        await tx.tradeLc.update({
          where: { id },
          data: {
            status: "SETTLED",
            version: { increment: 1 },
            updatedBy: ctx.userId,
          },
        });
        await appendTradeLcEventTx(tx, ctx, id, "SETTLED", "LC marked as settled during close");
      }

      nextStatus = "CLOSED";
      eventType = "CLOSED";
      eventMessage = "LC closed";
    }

    nextData.status = nextStatus;

    const result = await tx.tradeLc.updateMany({
      where: {
        id,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        version: version ?? current.version,
      },
      data: nextData,
    });

    if (result.count === 0) {
      throw new PlatformError("CONFLICT", "LC has been modified by another user");
    }

    await appendTradeLcEventTx(tx, ctx, id, eventType, eventMessage, auditPayload);
    return { nextStatus, eventType, auditPayload };
  });

  await writeTradeAudit(ctx, {
    action: `trade.lc.${action.toLowerCase()}`,
    entityType: "TradeLc",
    entityId: id,
    before: { status: current.status, version: current.version },
    after: { status: updated.nextStatus, version: current.version + 1, ...updated.auditPayload },
  });

  await writeTradeLedger(ctx, id, `TRADE_LC_${updated.eventType}`, {
    status: updated.nextStatus,
    version: current.version + 1,
    actorUserId: ctx.userId,
    ...updated.auditPayload,
  });

  return getLcDetail(ctx, id);
}

export async function submitLc(ctx: PlatformRequestContext, id: string, version?: number) {
  return applyLcAction(ctx, id, "SUBMIT", version);
}

export async function approveLc(ctx: PlatformRequestContext, id: string, version?: number) {
  return applyLcAction(ctx, id, "APPROVE", version);
}

export async function issueLc(ctx: PlatformRequestContext, id: string, version?: number) {
  return applyLcAction(ctx, id, "ISSUE", version);
}

export async function cancelLc(ctx: PlatformRequestContext, id: string, version?: number) {
  return applyLcAction(ctx, id, "CANCEL", version);
}

export async function closeLc(ctx: PlatformRequestContext, id: string, version?: number) {
  return applyLcAction(ctx, id, "CLOSE", version);
}

export async function listAllLcAmendments(ctx: PlatformRequestContext, input: WorklistInput) {
  await ensureTradeLcDefaults(ctx);
  const rows = await prisma.tradeLcAmendment.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      ...(input.status ? { status: input.status as TradeLcAmendmentStatus } : {}),
      ...(input.lcId ? { lcId: input.lcId } : {}),
    },
    include: {
      lc: {
        select: { id: true, lcNo: true, status: true },
      },
    },
    orderBy: [{ amendmentDate: "desc" }, { createdAt: "desc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  return {
    rows: rows.slice(0, input.limit).map((row) => ({
      id: row.id,
      lcId: row.lcId,
      lcNo: row.lc.lcNo ?? "Draft LC",
      amendmentNo: row.amendmentNo,
      amendmentDate: row.amendmentDate,
      reason: row.reason,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    nextCursor: rows.length > input.limit ? rows[input.limit]?.id ?? null : null,
  };
}

export async function listLcAmendments(ctx: PlatformRequestContext, lcId: string) {
  await requireScopedLc(prisma, ctx, lcId);
  return listAllLcAmendments(ctx, { lcId, limit: 100 });
}

export async function createLcAmendment(
  ctx: PlatformRequestContext,
  lcId: string,
  input: {
    amendmentNo?: string;
    amendmentDate: Date;
    changesJson: Record<string, unknown>;
    reason: string;
  },
) {
  const lc = await requireScopedLc(prisma, ctx, lcId);
  if (!postIssueStatusSet.has(lc.status) && lc.status !== "ACCEPTED" && lc.status !== "SETTLED") {
    throw new PlatformError("CONFLICT", "Amendments are only available after issue");
  }

  const amendmentCount = await prisma.tradeLcAmendment.count({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId,
    },
  });

  const created = await prisma.$transaction(async (tx) => {
    const amendment = await tx.tradeLcAmendment.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        lcId,
        amendmentNo: input.amendmentNo ?? `AMD-${String(amendmentCount + 1).padStart(3, "0")}`,
        amendmentDate: input.amendmentDate,
        changesJson: input.changesJson as Prisma.InputJsonValue,
        reason: input.reason,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
    return amendment;
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.amendment.created",
    entityType: "TradeLcAmendment",
    entityId: created.id,
    after: { lcId, amendmentNo: created.amendmentNo },
  });

  return created;
}

function pickAmendmentUpdateFields(changes: Record<string, unknown>) {
  const next: Prisma.TradeLcUpdateManyMutationInput = {};
  const stringFields = [
    "placeOfExpiry",
    "shipmentFrom",
    "shipmentTo",
    "portOfLoading",
    "portOfDischarge",
    "lienReference",
    "incotermCode",
    "remarks",
    "termsText",
  ] as const;

  for (const key of stringFields) {
    if (key in changes) {
      next[key] = typeof changes[key] === "string" ? (changes[key] as string) : null;
    }
  }

  if ("lcAmount" in changes) next.lcAmount = toDecimal(changes.lcAmount as number);
  if ("tolerancePercent" in changes) next.tolerancePercent = toDecimal(changes.tolerancePercent as number);
  if ("marginPercent" in changes) next.marginPercent = toDecimal(changes.marginPercent as number);
  if ("marginAmount" in changes) next.marginAmount = toDecimal(changes.marginAmount as number);
  if ("expiryDate" in changes) next.expiryDate = new Date(String(changes.expiryDate));
  if ("latestShipmentDate" in changes) next.latestShipmentDate = new Date(String(changes.latestShipmentDate));
  if ("maturityDate" in changes) next.maturityDate = new Date(String(changes.maturityDate));

  return next;
}

export async function publishLcAmendment(ctx: PlatformRequestContext, lcId: string, amendId: string) {
  const lc = await requireScopedLc(prisma, ctx, lcId);
  const amendment = await prisma.tradeLcAmendment.findFirst({
    where: {
      id: amendId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId,
    },
  });

  if (!amendment) {
    throw new PlatformError("NOT_FOUND", "Amendment not found");
  }
  if (amendment.status !== "DRAFT") {
    throw new PlatformError("CONFLICT", "Only DRAFT amendments can be published");
  }

  const changes = (amendment.changesJson as Record<string, unknown> | null) ?? {};
  const nextData = pickAmendmentUpdateFields(changes);
  if (Object.keys(nextData).length === 0) {
    throw new PlatformError("VALIDATION_ERROR", "No supported amendment fields were provided");
  }

  await prisma.$transaction(async (tx) => {
    await tx.tradeLc.update({
      where: { id: lc.id },
      data: {
        ...nextData,
        version: { increment: 1 },
        updatedBy: ctx.userId,
      },
    });
    await tx.tradeLcAmendment.update({
      where: { id: amendId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
    await appendTradeLcEventTx(tx, ctx, lcId, "AMENDED", "LC amendment published", {
      amendmentId: amendId,
      amendmentNo: amendment.amendmentNo,
    });
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.amendment.published",
    entityType: "TradeLcAmendment",
    entityId: amendId,
    before: { status: amendment.status },
    after: { status: "PUBLISHED" },
  });
  await writeTradeLedger(ctx, lcId, "TRADE_LC_AMENDED", {
    amendmentId: amendId,
    amendmentNo: amendment.amendmentNo,
  });

  return getLcDetail(ctx, lcId);
}

export async function listAllLcDocsets(ctx: PlatformRequestContext, input: WorklistInput) {
  await ensureTradeLcDefaults(ctx);
  const rows = await prisma.tradeLcDocumentSet.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      ...(input.status ? { status: input.status as TradeLcDocumentSetStatus } : {}),
      ...(input.lcId ? { lcId: input.lcId } : {}),
    },
    include: {
      lc: {
        select: {
          id: true,
          lcNo: true,
          beneficiaryVendor: { select: { name: true } },
        },
      },
      documentLines: true,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  return {
    rows: rows.slice(0, input.limit).map((row) => ({
      id: row.id,
      lcId: row.lcId,
      lcNo: row.lc.lcNo ?? "Draft LC",
      supplier: row.lc.beneficiaryVendor.name,
      shipmentRef: row.shipmentRef,
      shipmentDate: row.shipmentDate,
      etaDate: row.etaDate,
      docsReceivedDate: row.docsReceivedDate,
      status: row.status,
      requiredCount: row.documentLines.filter((line) => line.required).length,
      receivedCount: row.documentLines.filter((line) => line.received).length,
      updatedAt: row.updatedAt,
    })),
    nextCursor: rows.length > input.limit ? rows[input.limit]?.id ?? null : null,
  };
}

export async function listLcDocsets(ctx: PlatformRequestContext, lcId: string) {
  await requireScopedLc(prisma, ctx, lcId);
  return listAllLcDocsets(ctx, { lcId, limit: 100 });
}

export async function createLcDocset(
  ctx: PlatformRequestContext,
  lcId: string,
  input: {
    shipmentRef?: string;
    shipmentDate?: Date;
    etaDate?: Date;
    docsReceivedDate?: Date;
    verificationNotes?: string;
  },
) {
  const lc = await requireScopedLc(prisma, ctx, lcId);
  if (!postIssueStatusSet.has(lc.status) && lc.status !== "ACCEPTED" && lc.status !== "SETTLED") {
    throw new PlatformError("CONFLICT", "Document sets are only available after issue");
  }

  const documentTypes = await prisma.tradeLcDocumentType.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  const created = await prisma.$transaction(async (tx) => {
    if (lc.status === "ISSUED") {
      await tx.tradeLc.update({
        where: { id: lcId },
        data: {
          status: "ACTIVE",
          version: { increment: 1 },
          updatedBy: ctx.userId,
        },
      });
    }

    const docset = await tx.tradeLcDocumentSet.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        lcId,
        shipmentRef: input.shipmentRef ?? null,
        shipmentDate: input.shipmentDate ?? null,
        etaDate: input.etaDate ?? null,
        docsReceivedDate: input.docsReceivedDate ?? null,
        verificationNotes: input.verificationNotes ?? null,
        status: input.docsReceivedDate ? "RECEIVED" : "PENDING",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });

    if (documentTypes.length > 0) {
      await tx.tradeLcDocumentLine.createMany({
        data: documentTypes.map((item) => ({
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          documentSetId: docset.id,
          documentTypeCode: item.code,
          required: item.defaultRequired,
          received: false,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })),
      });
    }

    await appendTradeLcEventTx(tx, ctx, lcId, "DOCS_RECEIVED", "LC document set created", {
      documentSetId: docset.id,
    });
    return docset;
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.docset.created",
    entityType: "TradeLcDocumentSet",
    entityId: created.id,
    after: { lcId, status: created.status },
  });

  return getLcDocset(ctx, created.id);
}

export async function getLcDocset(ctx: PlatformRequestContext, docsetId: string) {
  const docset = await prisma.tradeLcDocumentSet.findFirst({
    where: {
      id: docsetId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    include: {
      lc: {
        select: {
          id: true,
          lcNo: true,
          status: true,
          beneficiaryVendor: { select: { name: true } },
        },
      },
      documentLines: {
        orderBy: [{ documentTypeCode: "asc" }],
      },
    },
  });

  if (!docset) {
    throw new PlatformError("NOT_FOUND", "Document set not found");
  }

  return {
    id: docset.id,
    lcId: docset.lcId,
    lcNo: docset.lc.lcNo ?? "Draft LC",
    lcStatus: resolveEffectiveLcStatus(docset.lc.status, new Date("9999-12-31")),
    supplier: docset.lc.beneficiaryVendor.name,
    shipmentRef: docset.shipmentRef,
    shipmentDate: docset.shipmentDate,
    etaDate: docset.etaDate,
    docsReceivedDate: docset.docsReceivedDate,
    status: docset.status,
    verificationNotes: docset.verificationNotes,
    documentLines: docset.documentLines.map((line) => ({
      id: line.id,
      documentTypeCode: line.documentTypeCode,
      required: line.required,
      received: line.received,
      referenceNo: line.referenceNo,
      issueDate: line.issueDate,
      notes: line.notes,
      attachmentId: line.attachmentId,
      createdAt: line.createdAt,
      updatedAt: line.updatedAt,
    })),
    createdAt: docset.createdAt,
    updatedAt: docset.updatedAt,
  };
}

export async function updateLcDocset(
  ctx: PlatformRequestContext,
  docsetId: string,
  input: {
    shipmentRef?: string;
    shipmentDate?: Date;
    etaDate?: Date;
    docsReceivedDate?: Date;
    verificationNotes?: string;
    status?: TradeLcDocumentSetStatus;
    documentLines?: Array<{
      id: string;
      received?: boolean;
      referenceNo?: string;
      issueDate?: Date;
      notes?: string;
      attachmentId?: string;
    }>;
  },
) {
  const existing = await prisma.tradeLcDocumentSet.findFirst({
    where: {
      id: docsetId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    select: { id: true, lcId: true, status: true },
  });

  if (!existing) {
    throw new PlatformError("NOT_FOUND", "Document set not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.tradeLcDocumentSet.update({
      where: { id: docsetId },
      data: {
        shipmentRef: input.shipmentRef ?? undefined,
        shipmentDate: input.shipmentDate ?? undefined,
        etaDate: input.etaDate ?? undefined,
        docsReceivedDate: input.docsReceivedDate ?? undefined,
        verificationNotes: input.verificationNotes ?? undefined,
        status: input.status ?? undefined,
        updatedBy: ctx.userId,
      },
    });

    for (const line of input.documentLines ?? []) {
      await tx.tradeLcDocumentLine.updateMany({
        where: {
          id: line.id,
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          documentSetId: docsetId,
        },
        data: {
          ...(line.received === undefined ? {} : { received: line.received }),
          ...(line.referenceNo === undefined ? {} : { referenceNo: line.referenceNo }),
          ...(line.issueDate === undefined ? {} : { issueDate: line.issueDate }),
          ...(line.notes === undefined ? {} : { notes: line.notes }),
          ...(line.attachmentId === undefined ? {} : { attachmentId: line.attachmentId }),
          updatedBy: ctx.userId,
        },
      });
    }

    if (input.docsReceivedDate) {
      const lc = await tx.tradeLc.findUnique({ where: { id: existing.lcId }, select: { status: true } });
      if (lc && (lc.status === "ACTIVE" || lc.status === "ISSUED")) {
        await tx.tradeLc.update({
          where: { id: existing.lcId },
          data: {
            status: "DOCS_RECEIVED",
            version: { increment: 1 },
            updatedBy: ctx.userId,
          },
        });
      }
    }
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.docset.updated",
    entityType: "TradeLcDocumentSet",
    entityId: docsetId,
    before: { status: existing.status },
    after: { status: input.status ?? existing.status },
  });

  return getLcDocset(ctx, docsetId);
}

export async function verifyLcDocset(ctx: PlatformRequestContext, docsetId: string) {
  const current = await getLcDocset(ctx, docsetId);
  if (!canVerifyDocumentChecklist(current.documentLines)) {
    throw new PlatformError("CONFLICT", "All required documents must be received before verification");
  }

  await prisma.$transaction(async (tx) => {
    await tx.tradeLcDocumentSet.update({
      where: { id: docsetId },
      data: {
        status: "VERIFIED",
        updatedBy: ctx.userId,
      },
    });

    const lc = await tx.tradeLc.findUnique({
      where: { id: current.lcId },
      select: { status: true },
    });
    if (lc && (lc.status === "ACTIVE" || lc.status === "DOCS_RECEIVED")) {
      await tx.tradeLc.update({
        where: { id: current.lcId },
        data: {
          status: "UNDER_SCRUTINY",
          version: { increment: 1 },
          updatedBy: ctx.userId,
        },
      });
    }

    await appendTradeLcEventTx(tx, ctx, current.lcId, "DOCSET_VERIFIED", "Document set verified", {
      documentSetId: docsetId,
    });
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.docset.verified",
    entityType: "TradeLcDocumentSet",
    entityId: docsetId,
    after: { status: "VERIFIED" },
  });

  return getLcDocset(ctx, docsetId);
}

export async function markLcDocsetDiscrepant(ctx: PlatformRequestContext, docsetId: string) {
  const current = await getLcDocset(ctx, docsetId);

  await prisma.$transaction(async (tx) => {
    await tx.tradeLcDocumentSet.update({
      where: { id: docsetId },
      data: {
        status: "DISCREPANT",
        updatedBy: ctx.userId,
      },
    });
    await tx.tradeLc.update({
      where: { id: current.lcId },
      data: {
        status: "DISCREPANT",
        version: { increment: 1 },
        updatedBy: ctx.userId,
      },
    });
    await appendTradeLcEventTx(tx, ctx, current.lcId, "DISCREPANCY_ADDED", "Document set marked discrepant", {
      documentSetId: docsetId,
    });
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.docset.mark_discrepant",
    entityType: "TradeLcDocumentSet",
    entityId: docsetId,
    after: { status: "DISCREPANT" },
  });

  return getLcDocset(ctx, docsetId);
}

export async function listAllLcDiscrepancies(ctx: PlatformRequestContext, input: WorklistInput) {
  await ensureTradeLcDefaults(ctx);

  const rows = await prisma.tradeLcDiscrepancy.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      ...(input.lcId ? { lcId: input.lcId } : {}),
      ...(input.status ? { decision: input.status as TradeLcDiscrepancyDecision } : {}),
    },
    include: {
      lc: {
        select: { id: true, lcNo: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  return {
    rows: rows.slice(0, input.limit).map((row) => ({
      id: row.id,
      lcId: row.lcId,
      lcNo: row.lc.lcNo ?? "Draft LC",
      documentSetId: row.documentSetId,
      code: row.code,
      title: row.title,
      description: row.description,
      severity: row.severity,
      decision: row.decision,
      decisionNotes: row.decisionNotes,
      decidedBy: row.decidedBy,
      decidedAt: row.decidedAt,
      updatedAt: row.updatedAt,
    })),
    nextCursor: rows.length > input.limit ? rows[input.limit]?.id ?? null : null,
  };
}

export async function listLcDiscrepancies(ctx: PlatformRequestContext, lcId: string) {
  await requireScopedLc(prisma, ctx, lcId);
  return listAllLcDiscrepancies(ctx, { lcId, limit: 100 });
}

export async function createLcDiscrepancy(
  ctx: PlatformRequestContext,
  lcId: string,
  input: {
    documentSetId?: string;
    code: string;
    title: string;
    description: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
  },
) {
  const lc = await requireScopedLc(prisma, ctx, lcId);
  if (!postIssueStatusSet.has(lc.status) && lc.status !== "ACCEPTED" && lc.status !== "SETTLED") {
    throw new PlatformError("CONFLICT", "Discrepancies can only be recorded after issue");
  }

  const created = await prisma.$transaction(async (tx) => {
    if (input.documentSetId) {
      const docset = await tx.tradeLcDocumentSet.findFirst({
        where: {
          id: input.documentSetId,
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          lcId,
        },
        select: { id: true },
      });
      if (!docset) {
        throw new PlatformError("VALIDATION_ERROR", "Document set not found for this LC");
      }
    }

    const discrepancy = await tx.tradeLcDiscrepancy.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        lcId,
        documentSetId: input.documentSetId ?? null,
        code: input.code,
        title: input.title,
        description: input.description,
        severity: input.severity,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });

    await tx.tradeLc.update({
      where: { id: lcId },
      data: {
        status: "DISCREPANT",
        version: { increment: 1 },
        updatedBy: ctx.userId,
      },
    });

    await appendTradeLcEventTx(tx, ctx, lcId, "DISCREPANCY_ADDED", "LC discrepancy added", {
      discrepancyId: discrepancy.id,
      code: discrepancy.code,
    });

    return discrepancy;
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.discrepancy.created",
    entityType: "TradeLcDiscrepancy",
    entityId: created.id,
    after: { lcId, code: created.code, severity: created.severity },
  });

  return created;
}

export async function updateLcDiscrepancy(
  ctx: PlatformRequestContext,
  discId: string,
  input: {
    title?: string;
    description?: string;
    severity?: "LOW" | "MEDIUM" | "HIGH";
    decisionNotes?: string;
    decision?: "ACCEPTED";
  },
) {
  const current = await prisma.tradeLcDiscrepancy.findFirst({
    where: {
      id: discId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
  });

  if (!current) {
    throw new PlatformError("NOT_FOUND", "Discrepancy not found");
  }
  if (current.decision !== "PENDING") {
    throw new PlatformError("CONFLICT", "Only pending discrepancies can be edited");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.tradeLcDiscrepancy.update({
      where: { id: discId },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.severity === undefined ? {} : { severity: input.severity }),
        ...(input.decisionNotes === undefined ? {} : { decisionNotes: input.decisionNotes }),
        ...(input.decision === undefined
          ? {}
          : {
              decision: "ACCEPTED",
              decidedBy: ctx.userId,
              decidedAt: new Date(),
            }),
        updatedBy: ctx.userId,
      },
    });

    if (input.decision === "ACCEPTED") {
      const nextStatus = await resolveDiscrepancyDrivenStatus(tx, ctx, current.lcId);
      if (nextStatus) {
        await tx.tradeLc.update({
          where: { id: current.lcId },
          data: {
            status: nextStatus,
            version: { increment: 1 },
            updatedBy: ctx.userId,
          },
        });
        await ensureSettlementSync(tx, ctx, current.lcId);
      }
      await appendTradeLcEventTx(tx, ctx, current.lcId, "ACCEPTED", "Discrepancy accepted", {
        discrepancyId: discId,
      });
    }

    return next;
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.discrepancy.updated",
    entityType: "TradeLcDiscrepancy",
    entityId: discId,
    before: { decision: current.decision, severity: current.severity },
    after: { decision: updated.decision, severity: updated.severity },
  });

  return updated;
}

async function applyDiscrepancyDecision(
  ctx: PlatformRequestContext,
  discId: string,
  decision: "WAIVED" | "REJECTED",
) {
  const current = await prisma.tradeLcDiscrepancy.findFirst({
    where: {
      id: discId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
  });
  if (!current) {
    throw new PlatformError("NOT_FOUND", "Discrepancy not found");
  }

  const eventType: TradeLcEventType = decision === "WAIVED" ? "DISCREPANCY_WAIVED" : "DISCREPANCY_REJECTED";

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.tradeLcDiscrepancy.update({
      where: { id: discId },
      data: {
        decision,
        decidedBy: ctx.userId,
        decidedAt: new Date(),
        updatedBy: ctx.userId,
      },
    });

    const nextStatus = await resolveDiscrepancyDrivenStatus(tx, ctx, current.lcId);
    if (nextStatus) {
      await tx.tradeLc.update({
        where: { id: current.lcId },
        data: {
          status: nextStatus,
          version: { increment: 1 },
          updatedBy: ctx.userId,
        },
      });
    }

    await ensureSettlementSync(tx, ctx, current.lcId);
    await appendTradeLcEventTx(tx, ctx, current.lcId, eventType, `Discrepancy ${decision.toLowerCase()}`, {
      discrepancyId: discId,
    });

    return next;
  });

  await writeTradeAudit(ctx, {
    action: `trade.lc.discrepancy.${decision.toLowerCase()}`,
    entityType: "TradeLcDiscrepancy",
    entityId: discId,
    before: { decision: current.decision },
    after: { decision },
  });

  return updated;
}

export async function waiveLcDiscrepancy(ctx: PlatformRequestContext, discId: string) {
  return applyDiscrepancyDecision(ctx, discId, "WAIVED");
}

export async function rejectLcDiscrepancy(ctx: PlatformRequestContext, discId: string) {
  return applyDiscrepancyDecision(ctx, discId, "REJECTED");
}

export async function listAllLcCharges(ctx: PlatformRequestContext, input: WorklistInput) {
  await ensureTradeLcDefaults(ctx);
  const rows = await prisma.tradeLcCharge.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      ...(input.lcId ? { lcId: input.lcId } : {}),
    },
    include: {
      lc: { select: { id: true, lcNo: true } },
    },
    orderBy: [{ chargeDate: "desc" }, { createdAt: "desc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  return {
    rows: rows.slice(0, input.limit).map((row) => ({
      id: row.id,
      lcId: row.lcId,
      lcNo: row.lc.lcNo ?? "Draft LC",
      chargeTypeCode: row.chargeTypeCode,
      amount: toNumber(row.amount),
      currency: row.currency,
      chargedBy: row.chargedBy,
      chargeDate: row.chargeDate,
      allocatable: row.allocatable,
      allocationTarget: row.allocationTarget,
      allocationNotes: row.allocationNotes,
      createdAt: row.createdAt,
    })),
    nextCursor: rows.length > input.limit ? rows[input.limit]?.id ?? null : null,
  };
}

export async function listLcCharges(ctx: PlatformRequestContext, lcId: string) {
  await requireScopedLc(prisma, ctx, lcId);
  return listAllLcCharges(ctx, { lcId, limit: 100 });
}

export async function createLcCharge(
  ctx: PlatformRequestContext,
  lcId: string,
  input: {
    chargeTypeCode: string;
    amount: number;
    currency: string;
    chargedBy: string;
    chargeDate: Date;
    allocatable?: boolean;
    allocationTarget?: "LANDED_COST" | "EXPENSE";
    allocationNotes?: string;
  },
) {
  const lc = await requireScopedLc(prisma, ctx, lcId);
  if (!postIssueStatusSet.has(lc.status) && lc.status !== "ACCEPTED" && lc.status !== "SETTLED") {
    throw new PlatformError("CONFLICT", "Charges can only be recorded after issue");
  }

  const chargeType = await prisma.tradeLcChargeType.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      code: input.chargeTypeCode,
      isActive: true,
    },
    select: { code: true },
  });
  if (!chargeType) {
    throw new PlatformError("VALIDATION_ERROR", "Charge type not found");
  }

  const charge = await prisma.tradeLcCharge.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId,
      chargeTypeCode: input.chargeTypeCode,
      amount: toDecimal(input.amount),
      currency: input.currency,
      chargedBy: input.chargedBy,
      chargeDate: input.chargeDate,
      allocatable: input.allocatable ?? false,
      allocationTarget: input.allocationTarget ?? null,
      allocationNotes: input.allocationNotes ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.charge.created",
    entityType: "TradeLcCharge",
    entityId: charge.id,
    after: { lcId, amount: input.amount, chargeTypeCode: input.chargeTypeCode },
  });

  return charge;
}

export async function listAllLcPayments(ctx: PlatformRequestContext, input: WorklistInput) {
  await ensureTradeLcDefaults(ctx);
  const rows = await prisma.tradeLcPayment.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      ...(input.lcId ? { lcId: input.lcId } : {}),
      ...(input.status ? { status: input.status as never } : {}),
    },
    include: {
      lc: { select: { id: true, lcNo: true } },
    },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  return {
    rows: rows.slice(0, input.limit).map((row) => ({
      id: row.id,
      lcId: row.lcId,
      lcNo: row.lc.lcNo ?? "Draft LC",
      paymentType: row.paymentType,
      amount: toNumber(row.amount),
      currency: row.currency,
      paymentDate: row.paymentDate,
      valueDate: row.valueDate,
      method: row.method,
      bankAccountId: row.bankAccountId,
      status: row.status,
      externalRef: row.externalRef,
      notes: row.notes,
      createdAt: row.createdAt,
    })),
    nextCursor: rows.length > input.limit ? rows[input.limit]?.id ?? null : null,
  };
}

export async function listLcPayments(ctx: PlatformRequestContext, lcId: string) {
  await requireScopedLc(prisma, ctx, lcId);
  return listAllLcPayments(ctx, { lcId, limit: 100 });
}

export async function createLcPayment(
  ctx: PlatformRequestContext,
  lcId: string,
  input: {
    paymentType: "MARGIN" | "SETTLEMENT" | "CHARGE" | "OTHER";
    amount: number;
    currency: string;
    paymentDate?: Date;
    valueDate?: Date;
    method: "BANK_TRANSFER" | "TT" | "CASH" | "OTHER";
    bankAccountId?: string;
    status?: "PLANNED" | "INITIATED" | "PAID" | "REVERSED";
    externalRef?: string;
    notes?: string;
  },
) {
  const lc = await requireScopedLc(prisma, ctx, lcId);
  if (!postIssueStatusSet.has(lc.status) && lc.status !== "ACCEPTED" && lc.status !== "SETTLED") {
    throw new PlatformError("CONFLICT", "Payments can only be recorded after issue");
  }

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.tradeLcPayment.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        lcId,
        paymentType: input.paymentType,
        amount: toDecimal(input.amount),
        currency: input.currency,
        paymentDate: input.paymentDate ?? new Date(),
        valueDate: input.valueDate ?? null,
        method: input.method,
        bankAccountId: input.bankAccountId ?? null,
        status: input.status ?? "PLANNED",
        externalRef: input.externalRef ?? null,
        notes: input.notes ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
    if (created.status === "PAID") {
      await ensureSettlementSync(tx, ctx, lcId);
    }
    return created;
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.payment.created",
    entityType: "TradeLcPayment",
    entityId: payment.id,
    after: { lcId, amount: input.amount, paymentType: input.paymentType, status: payment.status },
  });

  return payment;
}

export async function markLcPaymentPaid(
  ctx: PlatformRequestContext,
  paymentId: string,
  input: { paymentDate?: Date; valueDate?: Date },
) {
  const payment = await prisma.tradeLcPayment.findFirst({
    where: {
      id: paymentId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
  });
  if (!payment) {
    throw new PlatformError("NOT_FOUND", "Payment not found");
  }
  if (payment.status === "PAID") {
    return payment;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.tradeLcPayment.update({
      where: { id: paymentId },
      data: {
        status: "PAID",
        paymentDate: input.paymentDate ?? payment.paymentDate ?? new Date(),
        valueDate: input.valueDate ?? payment.valueDate,
        updatedBy: ctx.userId,
      },
    });

    await ensureSettlementSync(tx, ctx, payment.lcId);
    await appendTradeLcEventTx(tx, ctx, payment.lcId, "PAYMENT_POSTED", "LC payment marked paid", {
      paymentId,
      paymentType: payment.paymentType,
    });

    return next;
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.payment.mark_paid",
    entityType: "TradeLcPayment",
    entityId: paymentId,
    before: { status: payment.status },
    after: { status: "PAID" },
  });
  await writeTradeLedger(ctx, payment.lcId, "TRADE_LC_PAYMENT_POSTED", {
    paymentId,
    paymentType: payment.paymentType,
    amount: toNumber(payment.amount),
  });

  return updated;
}

export async function getTradeLcReport(
  ctx: PlatformRequestContext,
  report: "register" | "expiry" | "outstanding" | "charges" | "discrepancies",
  input: {
    status?: string;
    bank?: string;
    supplier?: string;
    from?: Date;
    to?: Date;
  },
) {
  if (report === "register") {
    const result = await listLcs(ctx, {
      limit: 500,
      query: undefined,
      cursor: undefined,
      status: input.status,
      bank: input.bank,
      supplier: input.supplier,
      from: input.from,
      to: input.to,
      currency: undefined,
    });
    return result.rows;
  }

  if (report === "expiry") {
    const rows = await prisma.tradeLc.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        status: { in: Array.from(openStatusSet) as TradeLcStatus[] },
        ...(input.from || input.to
          ? {
              expiryDate: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      include: {
        beneficiaryVendor: { select: { name: true, email: true, phone: true } },
        issuingBank: { select: { id: true, code: true, name: true, swift: true, country: true } },
        advisingBank: { select: { id: true, code: true, name: true, swift: true, country: true } },
        confirmingBank: { select: { id: true, code: true, name: true, swift: true, country: true } },
        poLinks: true,
      },
      orderBy: { expiryDate: "asc" },
    });
    return rows.map((row) => serializeLcRow(row));
  }

  if (report === "outstanding") {
    const listed = await listLcs(ctx, {
      limit: 500,
      query: undefined,
      cursor: undefined,
      status: undefined,
      bank: input.bank,
      supplier: input.supplier,
      from: input.from,
      to: input.to,
      currency: undefined,
    });
    return listed.rows.filter((row) => row.outstandingAmount > 0);
  }

  if (report === "charges") {
    return (await listAllLcCharges(ctx, { limit: 500 })).rows;
  }

  return (await listAllLcDiscrepancies(ctx, { limit: 500 })).rows;
}

export async function listTradeLcSettings(ctx: PlatformRequestContext) {
  await ensureTradeLcDefaults(ctx);
  const [settings, bankCount, docTypeCount, chargeTypeCount, incotermCount] = await Promise.all([
    prisma.tradeLcSetting.findUnique({
      where: {
        tenantId_companyId: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
        },
      },
    }),
    prisma.tradeLcBank.count({ where: { tenantId: ctx.tenantId, companyId: ctx.companyId } }),
    prisma.tradeLcDocumentType.count({ where: { tenantId: ctx.tenantId, companyId: ctx.companyId } }),
    prisma.tradeLcChargeType.count({ where: { tenantId: ctx.tenantId, companyId: ctx.companyId } }),
    prisma.tradeLcIncoterm.count({ where: { tenantId: ctx.tenantId, companyId: ctx.companyId } }),
  ]);

  return {
    settings,
    counts: {
      banks: bankCount,
      documentTypes: docTypeCount,
      chargeTypes: chargeTypeCount,
      incoterms: incotermCount,
    },
  };
}

export async function updateTradeLcSettings(
  ctx: PlatformRequestContext,
  input: {
    dualControlEnabled?: boolean;
    expiringSoonDays?: number;
    maturitySoonDays?: number;
  },
) {
  await ensureTradeLcDefaults(ctx);
  const updated = await prisma.tradeLcSetting.update({
    where: {
      tenantId_companyId: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
    },
    data: {
      ...(input.dualControlEnabled === undefined ? {} : { dualControlEnabled: input.dualControlEnabled }),
      ...(input.expiringSoonDays === undefined ? {} : { expiringSoonDays: input.expiringSoonDays }),
      ...(input.maturitySoonDays === undefined ? {} : { maturitySoonDays: input.maturitySoonDays }),
      updatedBy: ctx.userId,
    },
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.settings.updated",
    entityType: "TradeLcSetting",
    entityId: updated.id,
    source: "trade.lc.settings",
    after: {
      dualControlEnabled: updated.dualControlEnabled,
      expiringSoonDays: updated.expiringSoonDays,
      maturitySoonDays: updated.maturitySoonDays,
    },
  });

  return updated;
}

async function listMasterRecords<
  T extends
    | "tradeLcBank"
    | "tradeLcDocumentType"
    | "tradeLcChargeType"
    | "tradeLcIncoterm",
>(ctx: PlatformRequestContext, model: T) {
  return (prisma[model] as any).findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    orderBy: [{ code: "asc" }],
  });
}

export async function listLcBanks(ctx: PlatformRequestContext) {
  await ensureTradeLcDefaults(ctx);
  return listMasterRecords(ctx, "tradeLcBank");
}

export async function createLcBank(
  ctx: PlatformRequestContext,
  input: { code: string; name: string; swift?: string; address?: string; country?: string; isActive?: boolean },
) {
  const created = await prisma.tradeLcBank.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      code: input.code,
      name: input.name,
      swift: input.swift ?? null,
      address: input.address ?? null,
      country: input.country ?? null,
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });
  await writeTradeAudit(ctx, {
    action: "trade.lc.bank.created",
    entityType: "TradeLcBank",
    entityId: created.id,
    source: "trade.lc.settings",
    after: { code: created.code, name: created.name },
  });
  return created;
}

export async function updateLcBank(
  ctx: PlatformRequestContext,
  bankId: string,
  input: Partial<{ code: string; name: string; swift: string; address: string; country: string; isActive: boolean }>,
) {
  const updated = await prisma.tradeLcBank.updateMany({
    where: {
      id: bankId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    data: {
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.swift === undefined ? {} : { swift: input.swift }),
      ...(input.address === undefined ? {} : { address: input.address }),
      ...(input.country === undefined ? {} : { country: input.country }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      updatedBy: ctx.userId,
    },
  });
  if (updated.count === 0) {
    throw new PlatformError("NOT_FOUND", "Bank not found");
  }
  return prisma.tradeLcBank.findUnique({ where: { id: bankId } });
}

export async function listLcDocumentTypes(ctx: PlatformRequestContext) {
  await ensureTradeLcDefaults(ctx);
  return listMasterRecords(ctx, "tradeLcDocumentType");
}

export async function createLcDocumentType(
  ctx: PlatformRequestContext,
  input: {
    code: string;
    name: string;
    description?: string;
    defaultRequired?: boolean;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  return prisma.tradeLcDocumentType.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      defaultRequired: input.defaultRequired ?? true,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });
}

export async function updateLcDocumentType(
  ctx: PlatformRequestContext,
  documentTypeId: string,
  input: Partial<{
    code: string;
    name: string;
    description: string;
    defaultRequired: boolean;
    sortOrder: number;
    isActive: boolean;
  }>,
) {
  const updated = await prisma.tradeLcDocumentType.updateMany({
    where: {
      id: documentTypeId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    data: {
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.defaultRequired === undefined ? {} : { defaultRequired: input.defaultRequired }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      updatedBy: ctx.userId,
    },
  });
  if (updated.count === 0) {
    throw new PlatformError("NOT_FOUND", "Document type not found");
  }
  return prisma.tradeLcDocumentType.findUnique({ where: { id: documentTypeId } });
}

export async function listLcChargeTypes(ctx: PlatformRequestContext) {
  await ensureTradeLcDefaults(ctx);
  return listMasterRecords(ctx, "tradeLcChargeType");
}

export async function createLcChargeType(
  ctx: PlatformRequestContext,
  input: {
    code: string;
    name: string;
    defaultAllocatable?: boolean;
    defaultAllocationTarget?: "LANDED_COST" | "EXPENSE";
    isActive?: boolean;
  },
) {
  return prisma.tradeLcChargeType.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      code: input.code,
      name: input.name,
      defaultAllocatable: input.defaultAllocatable ?? false,
      defaultAllocationTarget: input.defaultAllocationTarget ?? null,
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });
}

export async function updateLcChargeType(
  ctx: PlatformRequestContext,
  chargeTypeId: string,
  input: Partial<{
    code: string;
    name: string;
    defaultAllocatable: boolean;
    defaultAllocationTarget: "LANDED_COST" | "EXPENSE";
    isActive: boolean;
  }>,
) {
  const updated = await prisma.tradeLcChargeType.updateMany({
    where: {
      id: chargeTypeId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    data: {
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.defaultAllocatable === undefined ? {} : { defaultAllocatable: input.defaultAllocatable }),
      ...(input.defaultAllocationTarget === undefined ? {} : { defaultAllocationTarget: input.defaultAllocationTarget }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      updatedBy: ctx.userId,
    },
  });
  if (updated.count === 0) {
    throw new PlatformError("NOT_FOUND", "Charge type not found");
  }
  return prisma.tradeLcChargeType.findUnique({ where: { id: chargeTypeId } });
}

export async function listLcIncoterms(ctx: PlatformRequestContext) {
  await ensureTradeLcDefaults(ctx);
  return listMasterRecords(ctx, "tradeLcIncoterm");
}

export async function createLcIncoterm(
  ctx: PlatformRequestContext,
  input: { code: string; name: string; description?: string; isActive?: boolean },
) {
  return prisma.tradeLcIncoterm.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });
}

export async function updateLcIncoterm(
  ctx: PlatformRequestContext,
  incotermId: string,
  input: Partial<{ code: string; name: string; description: string; isActive: boolean }>,
) {
  const updated = await prisma.tradeLcIncoterm.updateMany({
    where: {
      id: incotermId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    data: {
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      updatedBy: ctx.userId,
    },
  });
  if (updated.count === 0) {
    throw new PlatformError("NOT_FOUND", "Incoterm not found");
  }
  return prisma.tradeLcIncoterm.findUnique({ where: { id: incotermId } });
}

export async function listLcAttachments(ctx: PlatformRequestContext, lcId: string) {
  await requireScopedLc(prisma, ctx, lcId);
  return prisma.tradeLcAttachment.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createLcAttachmentUpload(
  ctx: PlatformRequestContext,
  input: {
    lcId?: string;
    documentLineId?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  },
) {
  if (input.lcId) {
    await requireScopedLc(prisma, ctx, input.lcId);
  }
  if (input.documentLineId) {
    const line = await prisma.tradeLcDocumentLine.findFirst({
      where: {
        id: input.documentLineId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
      select: { id: true, documentSet: { select: { lcId: true } } },
    });
    if (!line) {
      throw new PlatformError("VALIDATION_ERROR", "Document line not found");
    }
    if (!input.lcId) {
      input.lcId = line.documentSet.lcId;
    }
  }

  const upload = createUploadUrl({
    companyId: ctx.companyId,
    fileName: input.fileName,
    mimeType: input.mimeType,
  });

  const attachment = await prisma.tradeLcAttachment.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      lcId: input.lcId ?? null,
      documentLineId: input.documentLineId ?? null,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageKey: upload.storageKey,
      uploadedBy: ctx.userId,
      metadata: toJsonValue({ uploadStartedAt: new Date().toISOString() }),
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });

  await writeTradeAudit(ctx, {
    action: "trade.lc.attachment.upload_requested",
    entityType: "TradeLcAttachment",
    entityId: attachment.id,
    source: "trade.lc.attachment",
    after: { lcId: attachment.lcId, fileName: attachment.fileName },
  });

  return {
    attachment,
    upload,
  };
}

export async function finalizeLcAttachmentUpload(
  ctx: PlatformRequestContext,
  input: { attachmentId: string; storageKey: string },
) {
  const current = await prisma.tradeLcAttachment.findFirst({
    where: {
      id: input.attachmentId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
  });

  if (!current) {
    throw new PlatformError("NOT_FOUND", "Attachment not found");
  }
  if (current.storageKey !== input.storageKey) {
    throw new PlatformError("CONFLICT", "storageKey mismatch for attachment finalize");
  }

  const updated = await prisma.tradeLcAttachment.update({
    where: { id: current.id },
    data: {
      uploadedAt: new Date(),
      metadata: toJsonValue({
        ...((current.metadata as Record<string, unknown> | null) ?? {}),
        finalizedAt: new Date().toISOString(),
      }),
      updatedBy: ctx.userId,
    },
  });

  if (updated.documentLineId) {
    await prisma.tradeLcDocumentLine.updateMany({
      where: {
        id: updated.documentLineId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
      data: {
        attachmentId: updated.id,
        updatedBy: ctx.userId,
      },
    });
  }

  if (updated.lcId) {
    await appendTradeLcEvent(ctx, updated.lcId, "ATTACHMENT_UPLOADED", "LC attachment finalized", {
      attachmentId: updated.id,
      fileName: updated.fileName,
    });
  }

  await writeTradeAudit(ctx, {
    action: "trade.lc.attachment.finalized",
    entityType: "TradeLcAttachment",
    entityId: updated.id,
    source: "trade.lc.attachment",
    before: { uploadedAt: current.uploadedAt },
    after: { uploadedAt: updated.uploadedAt },
  });

  return updated;
}

export async function getLcAttachmentDownload(ctx: PlatformRequestContext, attachmentId: string) {
  const attachment = await prisma.tradeLcAttachment.findFirst({
    where: {
      id: attachmentId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
  });

  if (!attachment) {
    throw new PlatformError("NOT_FOUND", "Attachment not found");
  }

  return {
    attachment,
    download: createDownloadUrl({ storageKey: attachment.storageKey }),
  };
}
