import { NumberSeriesResetPolicy } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { NumberSeriesAllocationInput, PlatformRequestContext } from "@/modules/platform/domain/types";
import { companyCodeFormatKeys, type CompanyCodeFormatKey } from "@/modules/platform/domain/company-numbering";

const companyOnlyNumberingKeys = new Set<CompanyCodeFormatKey>(companyCodeFormatKeys);

export function formatDateParts(value: Date): {
  yyyy: string;
  yy: string;
  mm: string;
  dd: string;
} {
  const yyyy = String(value.getUTCFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(value.getUTCDate()).padStart(2, "0");
  return { yyyy, yy, mm, dd };
}

export function periodKeyFor(input: { date: Date; fiscalYear?: string; resetPolicy: NumberSeriesResetPolicy }): string {
  const parts = formatDateParts(input.date);

  switch (input.resetPolicy) {
    case NumberSeriesResetPolicy.FISCAL_YEAR:
      return input.fiscalYear?.trim() || parts.yyyy;
    case NumberSeriesResetPolicy.CALENDAR_YEAR:
      return parts.yyyy;
    case NumberSeriesResetPolicy.MONTHLY:
      return `${parts.yyyy}-${parts.mm}`;
    case NumberSeriesResetPolicy.NEVER:
    default:
      return "GLOBAL";
  }
}

export function applyPattern(input: {
  pattern: string;
  sequence: number;
  padding: number;
  tenantKey?: string | null;
  companyCode?: string | null;
  fiscalYear?: string;
  date: Date;
}): string {
  const parts = formatDateParts(input.date);
  const paddedByDefault = String(input.sequence).padStart(input.padding, "0");

  let output = input.pattern;
  output = output.replaceAll("{TENANT}", input.tenantKey ?? "TENANT");
  output = output.replaceAll("{COMP}", input.companyCode ?? "COMP");
  output = output.replaceAll("{FY}", input.fiscalYear ?? parts.yyyy);
  output = output.replaceAll("{YYYY}", parts.yyyy);
  output = output.replaceAll("{YY}", parts.yy);
  output = output.replaceAll("{MM}", parts.mm);
  output = output.replaceAll("{DD}", parts.dd);

  output = output.replace(/\{(#+)\}/g, (_match, hashes: string) => String(input.sequence).padStart(hashes.length, "0"));

  if (!output.includes(String(input.sequence))) {
    output = `${output}-${paddedByDefault}`;
  }

  return output;
}

export function validatePattern(pattern: string): void {
  const hasSequence = /\{#+\}/.test(pattern);
  if (!hasSequence) {
    throw new PlatformError("VALIDATION_ERROR", "Pattern must include a sequence token such as {####}");
  }
}

export async function listNumberSeries(ctx: PlatformRequestContext) {
  return prisma.numberSeries.findMany({
    where: {
      tenantId: ctx.tenantId,
      OR: [{ companyId: ctx.companyId }, { companyId: null }],
    },
    orderBy: [{ companyId: "desc" }, { key: "asc" }],
  });
}

export async function upsertNumberSeries(
  ctx: PlatformRequestContext,
  input: {
    companyId?: string;
    key: string;
    name: string;
    pattern: string;
    resetPolicy: NumberSeriesResetPolicy;
    startAt: number;
    padding: number;
    metadata?: Record<string, unknown>;
    isActive?: boolean;
  },
) {
  validatePattern(input.pattern);
  const companyId = input.companyId ?? ctx.companyId;
  if (companyId == null && companyOnlyNumberingKeys.has(input.key as CompanyCodeFormatKey)) {
    throw new PlatformError("VALIDATION_ERROR", `Series key '${input.key}' must be company-scoped`);
  }

  return prisma.numberSeries.upsert({
    where: {
      tenantId_companyId_key: {
        tenantId: ctx.tenantId,
        companyId,
        key: input.key,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      companyId,
      key: input.key,
      name: input.name,
      pattern: input.pattern,
      resetPolicy: input.resetPolicy,
      startAt: input.startAt,
      padding: input.padding,
      isActive: input.isActive ?? true,
      metadata: (input.metadata ?? null) as never,
    },
    update: {
      name: input.name,
      pattern: input.pattern,
      resetPolicy: input.resetPolicy,
      startAt: input.startAt,
      padding: input.padding,
      isActive: input.isActive ?? true,
      metadata: (input.metadata ?? null) as never,
    },
  });
}

async function resolveSeries(
  ctx: PlatformRequestContext,
  input: { key: string; companyId?: string | null; allowTenantFallback?: boolean },
) {
  const companyId = input.companyId ?? ctx.companyId;
  const allowTenantFallback = input.allowTenantFallback ?? true;
  const candidates = await prisma.numberSeries.findMany({
    where: {
      tenantId: ctx.tenantId,
      key: input.key,
      isActive: true,
      ...(allowTenantFallback ? { OR: [{ companyId }, { companyId: null }] } : { companyId }),
    },
    orderBy: [{ companyId: "desc" }, { updatedAt: "desc" }],
    take: 5,
  });

  const companySeries = candidates.find((series) => series.companyId === companyId);
  const tenantSeries = candidates.find((series) => series.companyId === null);

  return companySeries ?? tenantSeries ?? null;
}

export async function allocateSeriesNumber(
  ctx: PlatformRequestContext,
  input: NumberSeriesAllocationInput,
): Promise<{ seriesId: string; value: number; number: string; periodKey: string }> {
  const forceCompanyScope = companyOnlyNumberingKeys.has(input.key as CompanyCodeFormatKey);
  const series = await resolveSeries(ctx, {
    key: input.key,
    companyId: input.companyId,
    allowTenantFallback: !input.strictCompanyScope && !forceCompanyScope,
  });

  if (!series) {
    if (input.strictCompanyScope || forceCompanyScope) {
      throw new PlatformError("NOT_FOUND", `Number series '${input.key}' not found for active company`);
    }
    throw new PlatformError("NOT_FOUND", `Number series '${input.key}' not found`);
  }

  const date = input.date ?? new Date();
  const periodKey = periodKeyFor({
    date,
    fiscalYear: input.fiscalYear,
    resetPolicy: series.resetPolicy,
  });

  return prisma.$transaction(async (tx) => {
    await tx.numberSeriesCounter.upsert({
      where: {
        seriesId_periodKey: {
          seriesId: series.id,
          periodKey,
        },
      },
      create: {
        seriesId: series.id,
        periodKey,
        currentValue: series.startAt - 1,
      },
      update: {},
    });

    const updatedCounter = await tx.numberSeriesCounter.update({
      where: {
        seriesId_periodKey: {
          seriesId: series.id,
          periodKey,
        },
      },
      data: {
        currentValue: { increment: 1 },
      },
      select: { currentValue: true },
    });

    const tenant = await tx.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { key: true },
    });

    const company = series.companyId
      ? await tx.company.findUnique({
          where: { id: series.companyId },
          select: { slug: true },
        })
      : null;

    const formatted = applyPattern({
      pattern: series.pattern,
      sequence: updatedCounter.currentValue,
      padding: series.padding,
      tenantKey: tenant?.key,
      companyCode: company?.slug,
      fiscalYear: input.fiscalYear,
      date,
    });

    return {
      seriesId: series.id,
      value: updatedCounter.currentValue,
      number: formatted,
      periodKey,
    };
  });
}
