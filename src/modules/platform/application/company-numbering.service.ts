import { NumberSeriesResetPolicy } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MASTER_ADMIN_ROLE_NAME } from "@/modules/iam/application/master-admin";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  companyCodeFormatDefaults,
  companyCodeFormatKeys,
  type CompanyCodeFormatConfig,
  type CompanyCodeFormatKey,
  type CompanyNumberingMasterConfig,
} from "@/modules/platform/domain/company-numbering";
import { allocateSeriesNumber, applyPattern, validatePattern } from "@/modules/platform/application/numbering.service";
import { appendAuditEvent } from "@/modules/platform/application/audit-ledger.service";

const companyCodeKeySet = new Set<CompanyCodeFormatKey>(companyCodeFormatKeys);

export function assertMasterAdminOwner(ctx: PlatformRequestContext): void {
  if (ctx.role !== MASTER_ADMIN_ROLE_NAME) {
    throw new PlatformError("FORBIDDEN", "Only Master Admin can manage company numbering");
  }
}

function assertRequiredTokens(pattern: string, resetPolicy: NumberSeriesResetPolicy): void {
  if (!pattern.includes("{COMP}")) {
    throw new PlatformError("VALIDATION_ERROR", "Pattern must include {COMP}");
  }

  if (resetPolicy === NumberSeriesResetPolicy.FISCAL_YEAR && !pattern.includes("{FY}")) {
    throw new PlatformError("VALIDATION_ERROR", "FISCAL_YEAR reset policy requires {FY} token");
  }
}

function validateCompanySeriesConfig(input: {
  pattern: string;
  startAt: number;
  padding: number;
  resetPolicy: NumberSeriesResetPolicy;
}): void {
  validatePattern(input.pattern);
  assertRequiredTokens(input.pattern, input.resetPolicy);

  if (!Number.isInteger(input.startAt) || input.startAt < 1) {
    throw new PlatformError("VALIDATION_ERROR", "startAt must be an integer >= 1");
  }

  if (!Number.isInteger(input.padding) || input.padding < 1 || input.padding > 12) {
    throw new PlatformError("VALIDATION_ERROR", "padding must be an integer between 1 and 12");
  }
}

function toConfigRow(series: {
  key: string;
  name: string;
  pattern: string;
  resetPolicy: NumberSeriesResetPolicy;
  startAt: number;
  padding: number;
  isActive: boolean;
  metadata: unknown;
}): CompanyCodeFormatConfig {
  if (!companyCodeKeySet.has(series.key as CompanyCodeFormatKey)) {
    throw new PlatformError("VALIDATION_ERROR", `Unsupported company numbering key: ${series.key}`);
  }

  return {
    key: series.key as CompanyCodeFormatKey,
    name: series.name,
    pattern: series.pattern,
    resetPolicy: series.resetPolicy,
    startAt: series.startAt,
    padding: series.padding,
    isActive: series.isActive,
    metadata: (series.metadata as Record<string, unknown> | null) ?? null,
  };
}

async function ensureCompanySeriesRows(ctx: PlatformRequestContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.numberSeries.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        key: { in: [...companyCodeFormatKeys] },
      },
      select: { key: true },
    });

    const existingKeys = new Set(existing.map((entry) => entry.key));
    for (const key of companyCodeFormatKeys) {
      if (existingKeys.has(key)) continue;
      const defaults = companyCodeFormatDefaults[key];
      validateCompanySeriesConfig(defaults);

      await tx.numberSeries.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          key,
          name: defaults.name,
          pattern: defaults.pattern,
          resetPolicy: defaults.resetPolicy,
          startAt: defaults.startAt,
          padding: defaults.padding,
          isActive: defaults.isActive,
          metadata: (defaults.metadata ?? null) as never,
        },
      });
    }
  });
}

export async function listCompanyNumberingMasterConfig(
  ctx: PlatformRequestContext,
): Promise<CompanyNumberingMasterConfig> {
  await ensureCompanySeriesRows(ctx);

  const rows = await prisma.numberSeries.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      key: { in: [...companyCodeFormatKeys] },
    },
  });

  const byKey = new Map(rows.map((row) => [row.key, row]));

  return {
    companyId: ctx.companyId,
    formats: companyCodeFormatKeys.map((key) => {
      const row = byKey.get(key);
      if (!row) {
        throw new PlatformError("INTERNAL_ERROR", `Missing required company numbering row: ${key}`);
      }
      return toConfigRow(row);
    }),
  };
}

export async function updateCompanyNumberingMasterConfig(
  ctx: PlatformRequestContext,
  input: {
    formats: Array<{
      key: CompanyCodeFormatKey;
      pattern?: string;
      resetPolicy?: NumberSeriesResetPolicy;
      startAt?: number;
      padding?: number;
      isActive?: boolean;
    }>;
  },
): Promise<CompanyNumberingMasterConfig> {
  assertMasterAdminOwner(ctx);
  await ensureCompanySeriesRows(ctx);

  const changedRows = await prisma.$transaction(async (tx) => {
    const existingRows = await tx.numberSeries.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        key: { in: [...companyCodeFormatKeys] },
      },
    });
    const existingByKey = new Map(existingRows.map((row) => [row.key, row]));
    const changes: Array<{
      key: CompanyCodeFormatKey;
      before: CompanyCodeFormatConfig;
      after: CompanyCodeFormatConfig;
    }> = [];

    for (const patch of input.formats) {
      const existing = existingByKey.get(patch.key);
      if (!existing) {
        throw new PlatformError("NOT_FOUND", `Numbering key '${patch.key}' is not configured for this company`);
      }

      const next = {
        key: patch.key,
        name: existing.name,
        pattern: patch.pattern?.trim() || existing.pattern,
        resetPolicy: patch.resetPolicy ?? existing.resetPolicy,
        startAt: patch.startAt ?? existing.startAt,
        padding: patch.padding ?? existing.padding,
        isActive: patch.isActive ?? existing.isActive,
      };
      validateCompanySeriesConfig(next);

      const updated = await tx.numberSeries.update({
        where: { id: existing.id },
        data: {
          pattern: next.pattern,
          resetPolicy: next.resetPolicy,
          startAt: next.startAt,
          padding: next.padding,
          isActive: next.isActive,
        },
      });

      const before = toConfigRow(existing);
      const after = toConfigRow(updated);
      if (
        before.pattern !== after.pattern ||
        before.resetPolicy !== after.resetPolicy ||
        before.startAt !== after.startAt ||
        before.padding !== after.padding ||
        before.isActive !== after.isActive
      ) {
        changes.push({
          key: patch.key,
          before,
          after,
        });
      }
    }

    return changes;
  });

  for (const changed of changedRows) {
    await appendAuditEvent(ctx, {
      source: "platform.numbering",
      action: "company_numbering.updated",
      entityType: "NumberSeries",
      entityId: changed.key,
      before: changed.before,
      after: changed.after,
      metadata: { key: changed.key, managedBy: "MASTER_ADMIN" },
    });
  }

  return listCompanyNumberingMasterConfig(ctx);
}

export async function previewCompanyNumberingPattern(
  ctx: PlatformRequestContext,
  input: {
    key: CompanyCodeFormatKey;
    pattern?: string;
    resetPolicy?: NumberSeriesResetPolicy;
    padding?: number;
    sequence?: number;
    date?: Date;
    fiscalYear?: string;
  },
): Promise<{
  key: CompanyCodeFormatKey;
  preview: string;
  pattern: string;
  resetPolicy: NumberSeriesResetPolicy;
  sequence: number;
  padding: number;
}> {
  await ensureCompanySeriesRows(ctx);

  const row = await prisma.numberSeries.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      key: input.key,
    },
    select: {
      key: true,
      pattern: true,
      resetPolicy: true,
      padding: true,
      startAt: true,
    },
  });
  if (!row) {
    throw new PlatformError("NOT_FOUND", `Numbering key '${input.key}' is not configured for this company`);
  }

  const pattern = input.pattern?.trim() || row.pattern;
  const resetPolicy = input.resetPolicy ?? row.resetPolicy;
  const padding = input.padding ?? row.padding;
  const sequence = input.sequence ?? row.startAt;
  const date = input.date ?? new Date();

  validateCompanySeriesConfig({
    pattern,
    resetPolicy,
    padding,
    startAt: Math.max(sequence, 1),
  });

  const [tenant, company] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { key: true },
    }),
    prisma.company.findUnique({
      where: { id: ctx.companyId },
      select: { slug: true },
    }),
  ]);

  return {
    key: row.key as CompanyCodeFormatKey,
    preview: applyPattern({
      pattern,
      sequence,
      padding,
      tenantKey: tenant?.key ?? null,
      companyCode: company?.slug ?? null,
      fiscalYear: input.fiscalYear,
      date,
    }),
    pattern,
    resetPolicy,
    sequence,
    padding,
  };
}

export async function allocateCompanyRequiredSeriesNumber(
  ctx: PlatformRequestContext,
  input: {
    key: CompanyCodeFormatKey;
    date?: Date;
    fiscalYear?: string;
  },
): Promise<{ seriesId: string; value: number; number: string; periodKey: string }> {
  await ensureCompanySeriesRows(ctx);
  return allocateSeriesNumber(ctx, {
    key: input.key,
    companyId: ctx.companyId,
    date: input.date,
    fiscalYear: input.fiscalYear,
    strictCompanyScope: true,
  });
}
