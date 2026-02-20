import { AccountingPeriodStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { assertValidDateRange, assertPeriodIsOpen } from "@/modules/accounting/application/invariants";

export function toDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export async function listFiscalYears(ctx: PlatformRequestContext) {
  return prisma.fiscalYear.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    orderBy: [{ startDate: "desc" }],
    include: {
      periods: {
        orderBy: { startDate: "asc" },
      },
    },
  });
}

export async function createFiscalYear(
  ctx: PlatformRequestContext,
  input: {
    name: string;
    startDate: Date;
    endDate: Date;
    isDefault?: boolean;
  },
) {
  const startDate = toDateOnly(input.startDate);
  const endDate = toDateOnly(input.endDate);
  assertValidDateRange(startDate, endDate);

  const overlapping = await prisma.fiscalYear.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      OR: [
        {
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      ],
    },
    select: { id: true },
  });

  if (overlapping) {
    throw new PlatformError("VALIDATION_ERROR", "Fiscal year overlaps an existing fiscal year");
  }

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.fiscalYear.updateMany({
        where: { tenantId: ctx.tenantId, companyId: ctx.companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.fiscalYear.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: input.name,
        startDate,
        endDate,
        isDefault: input.isDefault ?? false,
        createdBy: ctx.userId,
      },
    });
  });
}

export async function listAccountingPeriods(
  ctx: PlatformRequestContext,
  input: { fiscalYearId?: string },
) {
  return prisma.accountingPeriod.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      ...(input.fiscalYearId ? { fiscalYearId: input.fiscalYearId } : {}),
    },
    orderBy: [{ startDate: "asc" }],
    include: {
      fiscalYear: {
        select: {
          id: true,
          name: true,
          isClosed: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });
}

export async function createAccountingPeriod(
  ctx: PlatformRequestContext,
  input: {
    fiscalYearId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isYearEnd?: boolean;
  },
) {
  const startDate = toDateOnly(input.startDate);
  const endDate = toDateOnly(input.endDate);
  assertValidDateRange(startDate, endDate);

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: {
      id: input.fiscalYearId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
  });

  if (!fiscalYear) {
    throw new PlatformError("NOT_FOUND", "Fiscal year not found");
  }

  if (startDate < fiscalYear.startDate || endDate > fiscalYear.endDate) {
    throw new PlatformError("VALIDATION_ERROR", "Accounting period must be within fiscal year range");
  }

  const overlapping = await prisma.accountingPeriod.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      fiscalYearId: input.fiscalYearId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true },
  });

  if (overlapping) {
    throw new PlatformError("VALIDATION_ERROR", "Accounting period overlaps an existing period");
  }

  return prisma.accountingPeriod.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      fiscalYearId: fiscalYear.id,
      name: input.name,
      startDate,
      endDate,
      isYearEnd: input.isYearEnd ?? false,
      status: AccountingPeriodStatus.OPEN,
    },
  });
}

export async function updateAccountingPeriodStatus(
  ctx: PlatformRequestContext,
  input: { periodId: string; status: AccountingPeriodStatus },
) {
  const period = await prisma.accountingPeriod.findFirst({
    where: {
      id: input.periodId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
    include: {
      fiscalYear: {
        select: { isClosed: true },
      },
    },
  });

  if (!period) {
    throw new PlatformError("NOT_FOUND", "Accounting period not found");
  }

  if (period.fiscalYear.isClosed && input.status === AccountingPeriodStatus.OPEN) {
    throw new PlatformError("VALIDATION_ERROR", "Cannot open period in closed fiscal year");
  }

  return prisma.accountingPeriod.update({
    where: { id: period.id },
    data: {
      status: input.status,
      closedAt: input.status === AccountingPeriodStatus.CLOSED ? new Date() : null,
      closedBy: input.status === AccountingPeriodStatus.CLOSED ? ctx.userId : null,
    },
  });
}

export async function resolvePostingPeriod(
  ctx: PlatformRequestContext,
  postingDateInput: Date,
): Promise<{
  postingDate: Date;
  fiscalYear: { id: string; name: string; isClosed: boolean };
  period: { id: string; name: string; status: AccountingPeriodStatus; isYearEnd: boolean };
}> {
  const postingDate = toDateOnly(postingDateInput);

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      startDate: { lte: postingDate },
      endDate: { gte: postingDate },
    },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      isClosed: true,
    },
  });

  if (!fiscalYear) {
    throw new PlatformError("VALIDATION_ERROR", "No fiscal year found for posting date");
  }

  const period = await prisma.accountingPeriod.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      fiscalYearId: fiscalYear.id,
      startDate: { lte: postingDate },
      endDate: { gte: postingDate },
    },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      isYearEnd: true,
    },
  });

  if (!period) {
    throw new PlatformError("VALIDATION_ERROR", "No accounting period found for posting date");
  }

  assertPeriodIsOpen({
    fiscalYearClosed: fiscalYear.isClosed,
    periodClosed: period.status === AccountingPeriodStatus.CLOSED,
  });

  return { postingDate, fiscalYear, period };
}
