import { PaymentEntryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  appendAuditEvent,
  appendImmutableLedgerEvent,
  enqueueOutboxEvent,
} from "@/modules/platform/application/audit-ledger.service";
import { allocateSeriesNumber } from "@/modules/platform/application/numbering.service";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { resolvePostingPeriod } from "@/modules/accounting/application/fiscal-period.service";

export type PaymentAllocationInput = {
  referenceType: string;
  referenceId: string;
  allocatedAmountCents: number;
  currency: string;
  exchangeRate?: number;
};

export function resolveReceivedAmountCents(input: {
  paidAmountCents: number;
  sourceCurrency: string;
  targetCurrency: string;
  exchangeRate?: number;
  receivedAmountCents?: number;
}): { receivedAmountCents: number; exchangeRate: number | null } {
  const sourceCurrency = input.sourceCurrency.toUpperCase();
  const targetCurrency = input.targetCurrency.toUpperCase();

  if (input.receivedAmountCents && input.receivedAmountCents > 0) {
    const derivedRate = input.paidAmountCents > 0 ? input.receivedAmountCents / input.paidAmountCents : 1;
    return {
      receivedAmountCents: input.receivedAmountCents,
      exchangeRate: sourceCurrency === targetCurrency ? 1 : input.exchangeRate ?? derivedRate,
    };
  }

  if (sourceCurrency === targetCurrency) {
    return {
      receivedAmountCents: input.paidAmountCents,
      exchangeRate: 1,
    };
  }

  if (!input.exchangeRate || input.exchangeRate <= 0) {
    throw new PlatformError("VALIDATION_ERROR", "exchangeRate is required when currencies differ");
  }

  return {
    receivedAmountCents: Math.round(input.paidAmountCents * input.exchangeRate),
    exchangeRate: input.exchangeRate,
  };
}

export function assertAllocationWithinPaidAmount(
  paidAmountCents: number,
  allocations: PaymentAllocationInput[],
): number {
  const totalAllocated = allocations.reduce((sum, row) => sum + row.allocatedAmountCents, 0);
  if (totalAllocated > paidAmountCents) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      `Allocation total ${totalAllocated} exceeds paid amount ${paidAmountCents}`,
    );
  }
  return totalAllocated;
}

async function resolveExchangeRateFromTable(input: {
  companyId: string;
  fromCurrency: string;
  toCurrency: string;
  postingDate: Date;
}): Promise<number | null> {
  if (input.fromCurrency === input.toCurrency) {
    return 1;
  }

  const row = await prisma.accountingExchangeRate.findFirst({
    where: {
      companyId: input.companyId,
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      isActive: true,
      effectiveDate: { lte: input.postingDate },
    },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    select: { rate: true },
  });

  return row ? Number(row.rate) : null;
}

async function resolvePaymentEntryNumber(
  ctx: PlatformRequestContext,
  postingDate: Date,
): Promise<string> {
  try {
    const period = await resolvePostingPeriod(ctx, postingDate);
    const allocated = await allocateSeriesNumber(ctx, {
      key: "PE",
      companyId: ctx.companyId,
      fiscalYear: period.fiscalYear.name,
      date: period.postingDate,
    });
    return allocated.number;
  } catch {
    const year = postingDate.getUTCFullYear();
    const shortId = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `PE-${year}-${shortId}`;
  }
}

async function assertAccountExists(companyId: string, accountId: string | undefined): Promise<void> {
  if (!accountId) return;
  const account = await prisma.account.findFirst({
    where: { id: accountId, companyId },
    select: { id: true },
  });
  if (!account) {
    throw new PlatformError("VALIDATION_ERROR", `Account '${accountId}' is invalid for this company`);
  }
}

async function assertCostCenterExists(companyId: string, costCenterId: string | undefined): Promise<void> {
  if (!costCenterId) return;
  const row = await prisma.accountingCostCenter.findFirst({
    where: { id: costCenterId, companyId },
    select: { id: true },
  });
  if (!row) {
    throw new PlatformError("VALIDATION_ERROR", `Cost center '${costCenterId}' is invalid for this company`);
  }
}

async function assertDimensionKeysExist(companyId: string, dimensions?: Record<string, string>): Promise<void> {
  if (!dimensions || Object.keys(dimensions).length === 0) return;
  const keys = Object.keys(dimensions);
  const existing = await prisma.accountingDimension.findMany({
    where: {
      companyId,
      key: { in: keys },
      isActive: true,
    },
    select: { key: true },
  });
  if (existing.length !== keys.length) {
    const existingSet = new Set(existing.map((row) => row.key));
    const missing = keys.filter((key) => !existingSet.has(key));
    throw new PlatformError("VALIDATION_ERROR", `Unknown inactive or missing dimensions: ${missing.join(", ")}`);
  }
}

function assertTransition(current: PaymentEntryStatus, action: "SUBMIT" | "POST" | "CANCEL"): void {
  if (action === "SUBMIT" && current !== PaymentEntryStatus.DRAFT) {
    throw new PlatformError("CONFLICT", `Cannot submit payment entry from ${current}`);
  }
  if (action === "POST" && current !== PaymentEntryStatus.SUBMITTED) {
    throw new PlatformError("CONFLICT", `Cannot post payment entry from ${current}`);
  }
  if (
    action === "CANCEL" &&
    current !== PaymentEntryStatus.DRAFT &&
    current !== PaymentEntryStatus.SUBMITTED
  ) {
    throw new PlatformError("CONFLICT", `Cannot cancel payment entry from ${current}`);
  }
}

export async function listPaymentEntries(
  ctx: PlatformRequestContext,
  input: {
    page: number;
    pageSize: number;
    status?: PaymentEntryStatus;
    type?: "INBOUND" | "OUTBOUND";
    q?: string;
  },
) {
  const where: Prisma.PaymentEntryWhereInput = {
    companyId: ctx.companyId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(input.q
      ? {
          OR: [
            { number: { contains: input.q, mode: "insensitive" } },
            { partyType: { contains: input.q, mode: "insensitive" } },
            { remarks: { contains: input.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const skip = (input.page - 1) * input.pageSize;
  const [rows, total] = await Promise.all([
    prisma.paymentEntry.findMany({
      where,
      include: {
        paidFromAccount: { select: { id: true, code: true, name: true } },
        paidToAccount: { select: { id: true, code: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true } },
        allocations: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
      orderBy: [{ postingDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: input.pageSize,
    }),
    prisma.paymentEntry.count({ where }),
  ]);

  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    rows,
  };
}

export async function createPaymentEntry(
  ctx: PlatformRequestContext,
  input: {
    number?: string;
    type: "INBOUND" | "OUTBOUND";
    partyType?: string;
    partyId?: string;
    postingDate?: Date;
    paidAmountCents: number;
    receivedAmountCents?: number;
    sourceCurrency: string;
    targetCurrency: string;
    exchangeRate?: number;
    paidFromAccountId?: string;
    paidToAccountId?: string;
    costCenterId?: string;
    dimensions?: Record<string, string>;
    remarks?: string;
    allocations: PaymentAllocationInput[];
  },
) {
  const postingDate = input.postingDate ?? new Date();
  const sourceCurrency = input.sourceCurrency.toUpperCase();
  const targetCurrency = input.targetCurrency.toUpperCase();

  await Promise.all([
    assertAccountExists(ctx.companyId, input.paidFromAccountId),
    assertAccountExists(ctx.companyId, input.paidToAccountId),
    assertCostCenterExists(ctx.companyId, input.costCenterId),
    assertDimensionKeysExist(ctx.companyId, input.dimensions),
  ]);

  const tableRate = await resolveExchangeRateFromTable({
    companyId: ctx.companyId,
    fromCurrency: sourceCurrency,
    toCurrency: targetCurrency,
    postingDate,
  });

  const fx = resolveReceivedAmountCents({
    paidAmountCents: input.paidAmountCents,
    sourceCurrency,
    targetCurrency,
    exchangeRate: input.exchangeRate ?? tableRate ?? undefined,
    receivedAmountCents: input.receivedAmountCents,
  });

  assertAllocationWithinPaidAmount(input.paidAmountCents, input.allocations);

  const number = input.number?.trim() || (await resolvePaymentEntryNumber(ctx, postingDate));

  const created = await prisma.paymentEntry.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      number,
      type: input.type,
      status: PaymentEntryStatus.DRAFT,
      partyType: input.partyType?.trim() || null,
      partyId: input.partyId?.trim() || null,
      postingDate,
      paidAmountCents: input.paidAmountCents,
      receivedAmountCents: fx.receivedAmountCents,
      sourceCurrency,
      targetCurrency,
      exchangeRate: fx.exchangeRate,
      paidFromAccountId: input.paidFromAccountId ?? null,
      paidToAccountId: input.paidToAccountId ?? null,
      costCenterId: input.costCenterId ?? null,
      dimensions: (input.dimensions ?? null) as Prisma.InputJsonValue,
      remarks: input.remarks ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
      allocations: {
        create: input.allocations.map((allocation) => ({
          referenceType: allocation.referenceType,
          referenceId: allocation.referenceId,
          allocatedAmountCents: allocation.allocatedAmountCents,
          currency: allocation.currency.toUpperCase(),
          exchangeRate: allocation.exchangeRate ?? null,
        })),
      },
    },
    include: {
      allocations: true,
      paidFromAccount: { select: { id: true, code: true, name: true } },
      paidToAccount: { select: { id: true, code: true, name: true } },
      costCenter: { select: { id: true, code: true, name: true } },
    },
  });

  await appendAuditEvent(ctx, {
    source: "accounting",
    action: "payment_entry.created",
    entityType: "PaymentEntry",
    entityId: created.id,
    after: {
      id: created.id,
      number: created.number,
      status: created.status,
      paidAmountCents: created.paidAmountCents,
      receivedAmountCents: created.receivedAmountCents,
      sourceCurrency: created.sourceCurrency,
      targetCurrency: created.targetCurrency,
    },
  });

  return created;
}

export async function applyPaymentEntryAction(
  ctx: PlatformRequestContext,
  input: {
    paymentEntryId: string;
    action: "SUBMIT" | "POST" | "CANCEL";
    postingDate?: Date;
    remarks?: string;
  },
) {
  const entry = await prisma.paymentEntry.findFirst({
    where: {
      id: input.paymentEntryId,
      companyId: ctx.companyId,
    },
    include: {
      allocations: true,
      paidFromAccount: { select: { id: true, code: true, name: true } },
      paidToAccount: { select: { id: true, code: true, name: true } },
      costCenter: { select: { id: true, code: true, name: true } },
    },
  });

  if (!entry) {
    throw new PlatformError("NOT_FOUND", "Payment entry not found");
  }

  if (input.action === "POST" && entry.status === PaymentEntryStatus.POSTED) {
    return entry;
  }

  assertTransition(entry.status, input.action);

  if (input.action === "SUBMIT") {
    const submitted = await prisma.paymentEntry.update({
      where: { id: entry.id },
      data: {
        status: PaymentEntryStatus.SUBMITTED,
        submittedAt: new Date(),
        submittedBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        allocations: true,
        paidFromAccount: { select: { id: true, code: true, name: true } },
        paidToAccount: { select: { id: true, code: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true } },
      },
    });

    await appendAuditEvent(ctx, {
      source: "accounting",
      action: "payment_entry.submitted",
      entityType: "PaymentEntry",
      entityId: submitted.id,
      before: { status: entry.status },
      after: { status: submitted.status },
    });

    return submitted;
  }

  if (input.action === "CANCEL") {
    const cancelled = await prisma.paymentEntry.update({
      where: { id: entry.id },
      data: {
        status: PaymentEntryStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: ctx.userId,
        remarks: input.remarks ?? entry.remarks,
        updatedBy: ctx.userId,
      },
      include: {
        allocations: true,
        paidFromAccount: { select: { id: true, code: true, name: true } },
        paidToAccount: { select: { id: true, code: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true } },
      },
    });

    await appendAuditEvent(ctx, {
      source: "accounting",
      action: "payment_entry.cancelled",
      entityType: "PaymentEntry",
      entityId: cancelled.id,
      before: { status: entry.status },
      after: { status: cancelled.status },
    });

    return cancelled;
  }

  if (!entry.paidFromAccountId || !entry.paidToAccountId) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "paidFromAccountId and paidToAccountId are required before posting a payment entry",
    );
  }

  const postingDate = input.postingDate ?? entry.postingDate;
  const periodContext = await resolvePostingPeriod(ctx, postingDate);
  const fxDifference = entry.receivedAmountCents - entry.paidAmountCents;
  const paidFromAccountId = entry.paidFromAccountId;
  const paidToAccountId = entry.paidToAccountId;

  let fxAccountId: string | null = null;
  if (fxDifference !== 0) {
    const fxAccountSetting = await prisma.orgSetting.findUnique({
      where: {
        companyId_key: {
          companyId: ctx.companyId,
          key: "accounting.fxGainLossAccountId",
        },
      },
      select: { value: true },
    });

    fxAccountId = fxAccountSetting?.value ?? null;
    if (!fxAccountId) {
      throw new PlatformError(
        "VALIDATION_ERROR",
        "FX difference detected but accounting.fxGainLossAccountId setting is not configured",
      );
    }

    await assertAccountExists(ctx.companyId, fxAccountId);
  }

  const metadata = {
    paymentEntryId: entry.id,
    costCenterId: entry.costCenterId,
    dimensions: entry.dimensions,
    exchangeRate: entry.exchangeRate ? Number(entry.exchangeRate) : null,
    sourceCurrency: entry.sourceCurrency,
    targetCurrency: entry.targetCurrency,
  } as const;

  await prisma.$transaction(async (tx) => {
    const glRows: Prisma.GLEntryCreateManyInput[] = [
      {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        postingDate: periodContext.postingDate,
        accountId: paidToAccountId,
        fiscalYearId: periodContext.fiscalYear.id,
        accountingPeriodId: periodContext.period.id,
        debitCents: entry.receivedAmountCents,
        creditCents: 0,
        currency: entry.targetCurrency,
        voucherType: "PAYMENT_ENTRY",
        voucherId: entry.id,
        remarks: entry.remarks ?? null,
        metadata: metadata as unknown as Prisma.InputJsonValue,
        createdBy: ctx.userId,
      },
      {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        postingDate: periodContext.postingDate,
        accountId: paidFromAccountId,
        fiscalYearId: periodContext.fiscalYear.id,
        accountingPeriodId: periodContext.period.id,
        debitCents: 0,
        creditCents: entry.paidAmountCents,
        currency: entry.sourceCurrency,
        voucherType: "PAYMENT_ENTRY",
        voucherId: entry.id,
        remarks: entry.remarks ?? null,
        metadata: metadata as unknown as Prisma.InputJsonValue,
        createdBy: ctx.userId,
      },
    ];

    if (fxDifference !== 0 && fxAccountId) {
      glRows.push({
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        postingDate: periodContext.postingDate,
        accountId: fxAccountId,
        fiscalYearId: periodContext.fiscalYear.id,
        accountingPeriodId: periodContext.period.id,
        debitCents: fxDifference < 0 ? Math.abs(fxDifference) : 0,
        creditCents: fxDifference > 0 ? fxDifference : 0,
        currency: entry.targetCurrency,
        voucherType: "PAYMENT_ENTRY",
        voucherId: entry.id,
        remarks: `FX adjustment for payment entry ${entry.number}`,
        metadata: metadata as unknown as Prisma.InputJsonValue,
        createdBy: ctx.userId,
      });
    }

    await tx.gLEntry.createMany({ data: glRows });

    await tx.paymentEntry.update({
      where: { id: entry.id },
      data: {
        status: PaymentEntryStatus.POSTED,
        postingDate: periodContext.postingDate,
        postedAt: new Date(),
        postedBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
  });

  const posted = await prisma.paymentEntry.findUnique({
    where: { id: entry.id },
    include: {
      allocations: true,
      paidFromAccount: { select: { id: true, code: true, name: true } },
      paidToAccount: { select: { id: true, code: true, name: true } },
      costCenter: { select: { id: true, code: true, name: true } },
    },
  });

  if (!posted) {
    throw new PlatformError("NOT_FOUND", "Payment entry not found after posting");
  }

  await appendAuditEvent(ctx, {
    source: "accounting",
    action: "payment_entry.posted",
    entityType: "PaymentEntry",
    entityId: posted.id,
    before: { status: entry.status },
    after: {
      status: posted.status,
      postedAt: posted.postedAt,
      postingDate: posted.postingDate,
    },
  });

  await appendImmutableLedgerEvent(ctx, {
    stream: "accounting",
    eventType: "PAYMENT_ENTRY_POSTED",
    entityType: "PaymentEntry",
    entityId: posted.id,
    payload: {
      paymentEntryId: posted.id,
      number: posted.number,
      status: posted.status,
      paidAmountCents: posted.paidAmountCents,
      receivedAmountCents: posted.receivedAmountCents,
      sourceCurrency: posted.sourceCurrency,
      targetCurrency: posted.targetCurrency,
      exchangeRate: posted.exchangeRate ? Number(posted.exchangeRate) : null,
      costCenterId: posted.costCenterId,
      dimensions: posted.dimensions,
      allocations: posted.allocations.length,
    },
  });

  await enqueueOutboxEvent(ctx, {
    topic: "accounting.payment_entry.posted",
    aggregateType: "PaymentEntry",
    aggregateId: posted.id,
    payload: {
      paymentEntryId: posted.id,
      number: posted.number,
      status: posted.status,
      postedAt: posted.postedAt?.toISOString() ?? null,
    },
  });

  return posted;
}
