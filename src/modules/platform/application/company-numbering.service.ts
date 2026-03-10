import { NumberSeriesResetPolicy } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MASTER_ADMIN_ROLE_NAME } from "@/modules/iam/application/master-admin";
import { appendAuditEvent } from "@/modules/platform/application/audit-ledger.service";
import { allocateSeriesNumber, applyPattern, validatePattern } from "@/modules/platform/application/numbering.service";
import {
  applyStoredMetadataToDefinition,
  buildSettingsEnvelopeFromDefinitions,
  compareFormatConfigChanges,
  companyCodeSettingsVersion,
  getCompatibilityProjection,
  loadYgenDefaults,
  parseCodeFormatDefinition,
  parseSettingsEnvelope,
  previewStructuredCompanyNumbering,
  serializeCodeFormatConfig,
  validateCodeFormatConfig,
  type CodeFormatDefinition,
  type CompanyCodeDefinitionKey,
  type CompanyCodeFormatSettingsEnvelope,
  type StructuredCompanyNumberingPreview,
  type ValidationIssue,
  companyCodeDefinitionKeys,
} from "@/modules/platform/domain/company-code-format-settings";
import {
  companyCodeFormatDefaults,
  companyCodeFormatKeys,
  type CompanyCodeFormatConfig,
  type CompanyCodeFormatKey,
  type CompanyNumberingMasterConfig,
} from "@/modules/platform/domain/company-numbering";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const companyCodeKeySet = new Set<CompanyCodeFormatKey>(companyCodeFormatKeys);
const richCompanyCodeKeySet = new Set<CompanyCodeDefinitionKey>(companyCodeDefinitionKeys);

type CompanyNumberingMasterConfigResponse = CompanyNumberingMasterConfig & {
  settings: CompanyCodeFormatSettingsEnvelope;
};

type CompanyNumberingLegacyUpdateInput = {
  formats: Array<{
    key: CompanyCodeFormatKey;
    pattern?: string;
    resetPolicy?: NumberSeriesResetPolicy;
    startAt?: number;
    padding?: number;
    isActive?: boolean;
  }>;
};

type CompanyNumberingStructuredUpdateInput = {
  action?: "SAVE" | "RESET";
  settings?: unknown;
};

type CompanyNumberingPreviewInput = {
  key: CompanyCodeFormatKey;
  pattern?: string;
  resetPolicy?: NumberSeriesResetPolicy;
  padding?: number;
  sequence?: number;
  date?: Date;
  fiscalYear?: string;
  definition?: unknown;
  variantId?: string;
  sample?: Record<string, unknown>;
};

function asPlainObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function assertMasterAdminOwner(ctx: PlatformRequestContext): void {
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

function loadDefinitionFromRow(row: CompanyCodeFormatConfig): {
  definition: CodeFormatDefinition | null;
  warning?: string;
  savedAt?: string | null;
  savedBy?: string | null;
} {
  if (!richCompanyCodeKeySet.has(row.key as CompanyCodeDefinitionKey)) {
    return { definition: null };
  }

  const metadata = asPlainObject(row.metadata);
  const richRecord = metadata.companyCodeFormatV1;
  const applied = applyStoredMetadataToDefinition(row, richRecord);
  if (!applied) {
    return { definition: null };
  }

  const stored = richRecord ? asPlainObject(richRecord) : null;
  return {
    definition: applied.definition,
    warning: applied.warning,
    savedAt: typeof stored?.savedAt === "string" ? stored.savedAt : null,
    savedBy: typeof stored?.savedBy === "string" ? stored.savedBy : null,
  };
}

function buildSettingsFromRows(
  companyId: string,
  rows: CompanyCodeFormatConfig[],
): CompanyCodeFormatSettingsEnvelope {
  const warnings: string[] = [];
  let source: CompanyCodeFormatSettingsEnvelope["source"] = "stored";
  let newestSavedAt: string | null = null;
  let newestSavedBy: string | null = null;

  const definitions = companyCodeDefinitionKeys.map((key) => {
    const row = rows.find((entry) => entry.key === key);
    if (!row) {
      source = "derived-flat";
      warnings.push(`Missing ${key} series row; YGEN defaults were loaded as a fallback.`);
      return loadYgenDefaults(companyId).definitions.find((definition) => definition.key === key)!;
    }

    const loaded = loadDefinitionFromRow(row);
    if (!loaded.definition) {
      source = "derived-flat";
      warnings.push(`Unable to recover rich config for ${key}; YGEN defaults were used instead.`);
      return loadYgenDefaults(companyId).definitions.find((definition) => definition.key === key)!;
    }

    if (loaded.warning) {
      source = "derived-flat";
      warnings.push(loaded.warning);
    }

    if (loaded.savedAt && (!newestSavedAt || loaded.savedAt > newestSavedAt)) {
      newestSavedAt = loaded.savedAt;
      newestSavedBy = loaded.savedBy ?? null;
    }

    return loaded.definition;
  });

  return buildSettingsEnvelopeFromDefinitions({
    companyId,
    definitions,
    source,
    warnings,
    updatedAt: newestSavedAt,
    updatedBy: newestSavedBy,
  });
}

function assertNoBlockingIssues(issues: ValidationIssue[]): void {
  const blocking = issues.filter((issue) => issue.severity === "error");
  if (blocking.length > 0) {
    throw new PlatformError("VALIDATION_ERROR", "Company code format settings contain validation errors", {
      issues: blocking,
    });
  }
}

export async function listCompanyNumberingMasterConfig(
  ctx: PlatformRequestContext,
): Promise<CompanyNumberingMasterConfigResponse> {
  await ensureCompanySeriesRows(ctx);

  const rows = await prisma.numberSeries.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      key: { in: [...companyCodeFormatKeys] },
    },
  });

  const byKey = new Map(rows.map((row) => [row.key, row]));
  const formats = companyCodeFormatKeys.map((key) => {
    const row = byKey.get(key);
    if (!row) {
      throw new PlatformError("INTERNAL_ERROR", `Missing required company numbering row: ${key}`);
    }
    return toConfigRow(row);
  });

  return {
    companyId: ctx.companyId,
    formats,
    settings: buildSettingsFromRows(ctx.companyId, formats),
  };
}

export async function getCompanyCodeSettings(
  ctx: PlatformRequestContext,
): Promise<CompanyCodeFormatSettingsEnvelope> {
  return (await listCompanyNumberingMasterConfig(ctx)).settings;
}

export async function updateCompanyNumberingMasterConfig(
  ctx: PlatformRequestContext,
  input: CompanyNumberingLegacyUpdateInput,
): Promise<CompanyNumberingMasterConfigResponse> {
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
      metadata: { key: changed.key, managedBy: "MASTER_ADMIN", mode: "legacy" },
    });
  }

  return listCompanyNumberingMasterConfig(ctx);
}

async function saveSettingsEnvelope(
  ctx: PlatformRequestContext,
  envelope: CompanyCodeFormatSettingsEnvelope,
): Promise<CompanyNumberingMasterConfigResponse> {
  assertMasterAdminOwner(ctx);
  await ensureCompanySeriesRows(ctx);

  const nextEnvelope = buildSettingsEnvelopeFromDefinitions({
    companyId: ctx.companyId,
    definitions: envelope.definitions,
    source: "stored",
    warnings: [],
    updatedAt: new Date().toISOString(),
    updatedBy: ctx.userId,
  });
  assertNoBlockingIssues(previewEnvelopeIssues(nextEnvelope));
  const previousEnvelope = await getCompanyCodeSettings(ctx);
  const summary = compareFormatConfigChanges(previousEnvelope, nextEnvelope);
  const now = new Date().toISOString();

  const changed = await prisma.$transaction(async (tx) => {
    const rows = await tx.numberSeries.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        key: { in: [...companyCodeFormatKeys] },
      },
    });
    const rowsByKey = new Map(rows.map((row) => [row.key, row]));
    const changes: Array<{
      key: CompanyCodeDefinitionKey;
      beforeFlat: CompanyCodeFormatConfig;
      afterFlat: CompanyCodeFormatConfig;
      beforeDefinition: CodeFormatDefinition | null;
      afterDefinition: CodeFormatDefinition;
    }> = [];

    for (const definition of nextEnvelope.definitions) {
      const existing = rowsByKey.get(definition.key);
      if (!existing) {
        throw new PlatformError("NOT_FOUND", `Numbering key '${definition.key}' is not configured for this company`);
      }

      const projection = getCompatibilityProjection(definition);
      validateCompanySeriesConfig({
        pattern: projection.pattern,
        resetPolicy: projection.resetPolicy,
        startAt: Math.max(1, projection.startAt),
        padding: projection.padding,
      });

      const existingFlat = toConfigRow(existing);
      const currentMetadata = asPlainObject(existing.metadata);
      const savedDefinition = {
        ...definition,
        updatedAt: now,
        updatedBy: ctx.userId,
        version: companyCodeSettingsVersion,
      };

      const updated = await tx.numberSeries.update({
        where: { id: existing.id },
        data: {
          pattern: projection.pattern,
          resetPolicy: projection.resetPolicy,
          startAt: Math.max(1, projection.startAt),
          padding: projection.padding,
          isActive: projection.isActive,
          metadata: {
            ...currentMetadata,
            companyCodeFormatV1: serializeCodeFormatConfig(savedDefinition, {
              savedAt: now,
              savedBy: ctx.userId,
            }),
          } as never,
        },
      });

      const previousDefinition = loadDefinitionFromRow(existingFlat).definition;
      changes.push({
        key: definition.key,
        beforeFlat: existingFlat,
        afterFlat: toConfigRow(updated),
        beforeDefinition: previousDefinition,
        afterDefinition: savedDefinition,
      });
    }

    return changes;
  });

  for (const entry of changed) {
    await appendAuditEvent(ctx, {
      source: "platform.numbering",
      action: "company_code_format.saved",
      entityType: "NumberSeries",
      entityId: entry.key,
      before: {
        compatibility: entry.beforeFlat,
        definition: entry.beforeDefinition,
      },
      after: {
        compatibility: entry.afterFlat,
        definition: entry.afterDefinition,
      },
      metadata: {
        key: entry.key,
        managedBy: "MASTER_ADMIN",
        mode: "rich",
        changedKeys: summary.changedKeys,
        changedVariants: summary.changedVariants,
        totalChanges: summary.totalChanges,
      },
    });
  }

  return listCompanyNumberingMasterConfig(ctx);
}

function previewEnvelopeIssues(envelope: CompanyCodeFormatSettingsEnvelope): ValidationIssue[] {
  return validateCodeFormatConfig(envelope);
}

export async function saveCompanyCodeSettings(
  ctx: PlatformRequestContext,
  input: CompanyNumberingStructuredUpdateInput,
): Promise<CompanyNumberingMasterConfigResponse> {
  assertMasterAdminOwner(ctx);
  if (input.action === "RESET") {
    return resetCompanyCodeSettings(ctx);
  }

  const parsed = parseSettingsEnvelope(input.settings);
  if (!parsed) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid company code settings payload");
  }

  return saveSettingsEnvelope(ctx, parsed);
}

export async function resetCompanyCodeSettings(
  ctx: PlatformRequestContext,
): Promise<CompanyNumberingMasterConfigResponse> {
  assertMasterAdminOwner(ctx);
  return saveSettingsEnvelope(ctx, loadYgenDefaults(ctx.companyId));
}

export async function previewCompanyNumberingPattern(
  ctx: PlatformRequestContext,
  input: CompanyNumberingPreviewInput,
): Promise<
  | {
      key: CompanyCodeFormatKey;
      preview: string;
      pattern: string;
      resetPolicy: NumberSeriesResetPolicy;
      sequence: number;
      padding: number;
    }
  | StructuredCompanyNumberingPreview
> {
  if ("definition" in input && input.definition) {
    if (!input.variantId?.trim()) {
      throw new PlatformError("VALIDATION_ERROR", "Structured numbering previews require variantId");
    }
    const definition = parseCodeFormatDefinition(input.definition);
    if (!definition) {
      throw new PlatformError("VALIDATION_ERROR", "Invalid structured definition preview payload");
    }

    if (!richCompanyCodeKeySet.has(definition.key)) {
      throw new PlatformError("VALIDATION_ERROR", `Unsupported structured numbering key '${definition.key}'`);
    }

    return previewStructuredCompanyNumbering({
      definition,
      variantId: input.variantId,
      sample: input.sample as never,
    });
  }

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

export { assertMasterAdminOwner };
