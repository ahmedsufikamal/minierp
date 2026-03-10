import { NumberSeriesResetPolicy } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

type NumberSeriesRow = {
  id: string;
  tenantId: string;
  companyId: string;
  key: string;
  name: string;
  pattern: string;
  resetPolicy: NumberSeriesResetPolicy;
  startAt: number;
  padding: number;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
};

const state = vi.hoisted(() => ({
  rows: [] as NumberSeriesRow[],
  idCounter: 1,
  appendAuditEvent: vi.fn(),
}));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function matchWhere(row: NumberSeriesRow, where: Record<string, unknown> | undefined) {
  if (!where) return true;
  if (typeof where.tenantId === "string" && row.tenantId !== where.tenantId) return false;
  if (typeof where.companyId === "string" && row.companyId !== where.companyId) return false;
  const keyFilter = where.key;
  if (keyFilter && typeof keyFilter === "object" && !Array.isArray(keyFilter)) {
    const values = (keyFilter as { in?: string[] }).in;
    if (values && !values.includes(row.key)) return false;
  } else if (typeof keyFilter === "string" && row.key !== keyFilter) {
    return false;
  }
  if (typeof where.id === "string" && row.id !== where.id) return false;
  return true;
}

const prismaMocks = vi.hoisted(() => ({
  findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
    clone(state.rows.filter((row) => matchWhere(row, where))),
  ),
  findFirst: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
    clone(state.rows.find((row) => matchWhere(row, where)) ?? null),
  ),
  create: vi.fn(async ({ data }: { data: Omit<NumberSeriesRow, "id"> }) => {
    const created: NumberSeriesRow = {
      id: `series-${state.idCounter++}`,
      ...clone(data),
    };
    state.rows.push(created);
    return clone(created);
  }),
  update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<NumberSeriesRow> }) => {
    const index = state.rows.findIndex((row) => row.id === where.id);
    if (index < 0) {
      throw new Error(`Unknown NumberSeries row '${where.id}'`);
    }
    state.rows[index] = {
      ...state.rows[index],
      ...clone(data),
    };
    return clone(state.rows[index]);
  }),
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      numberSeries: {
        findMany: prismaMocks.findMany,
        create: prismaMocks.create,
        update: prismaMocks.update,
      },
    }),
  ),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: prismaMocks.$transaction,
    numberSeries: {
      findMany: prismaMocks.findMany,
      findFirst: prismaMocks.findFirst,
    },
    tenant: {
      findUnique: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/modules/platform/application/audit-ledger.service", () => ({
  appendAuditEvent: state.appendAuditEvent,
}));

import {
  companyCodeDefinitionKeys,
  getCompatibilityProjection,
  loadYgenDefaults,
} from "@/modules/platform/domain/company-code-format-settings";
import {
  listCompanyNumberingMasterConfig,
  resetCompanyCodeSettings,
  saveCompanyCodeSettings,
} from "@/modules/platform/application/company-numbering.service";
import { companyCodeFormatDefaults, companyCodeFormatKeys } from "@/modules/platform/domain/company-numbering";

const ctx: PlatformRequestContext = {
  requestId: "req-1",
  tenantId: "tenant-1",
  companyId: "company-1",
  userId: "user-1",
  role: "OWNER",
  platformRole: "NONE",
  permissions: [],
};

function seedLegacyRows() {
  state.rows = companyCodeFormatKeys.map((key) => ({
    id: `series-${state.idCounter++}`,
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    key,
    name: companyCodeFormatDefaults[key].name,
    pattern: companyCodeFormatDefaults[key].pattern,
    resetPolicy: companyCodeFormatDefaults[key].resetPolicy,
    startAt: companyCodeFormatDefaults[key].startAt,
    padding: companyCodeFormatDefaults[key].padding,
    isActive: companyCodeFormatDefaults[key].isActive,
    metadata: null,
  }));
}

beforeEach(() => {
  state.rows = [];
  state.idCounter = 1;
  prismaMocks.findMany.mockClear();
  prismaMocks.findFirst.mockClear();
  prismaMocks.create.mockClear();
  prismaMocks.update.mockClear();
  prismaMocks.$transaction.mockClear();
  state.appendAuditEvent.mockReset();
});

describe("company numbering rich settings service", () => {
  it("falls back to derived-flat settings when rich metadata is missing", async () => {
    seedLegacyRows();

    const result = await listCompanyNumberingMasterConfig(ctx);

    expect(result.settings.source).toBe("derived-flat");
    expect(result.settings.warnings).toHaveLength(companyCodeDefinitionKeys.length);
    expect(result.settings.definitions).toHaveLength(companyCodeDefinitionKeys.length);
  });

  it("persists YGEN rich metadata and emits audit events", async () => {
    seedLegacyRows();
    const envelope = loadYgenDefaults(ctx.companyId);

    const result = await saveCompanyCodeSettings(ctx, {
      action: "SAVE",
      settings: envelope,
    });

    expect(result.settings.source).toBe("stored");
    expect(result.settings.warnings).toEqual([]);
    expect(result.settings.updatedBy).toBe(ctx.userId);
    expect(state.appendAuditEvent).toHaveBeenCalledTimes(companyCodeDefinitionKeys.length);

    const quotation = state.rows.find((row) => row.key === "QUOTATION");
    const quotationDefinition = envelope.definitions.find((definition) => definition.key === "QUOTATION");
    expect(quotation?.metadata?.companyCodeFormatV1).toBeTruthy();
    expect(quotation?.pattern).toBe(getCompatibilityProjection(quotationDefinition!).pattern);
    expect(quotation?.padding).toBe(getCompatibilityProjection(quotationDefinition!).padding);

    const firstAudit = state.appendAuditEvent.mock.calls[0]?.[1] as {
      action: string;
      metadata: { mode: string };
      after: { definition: { updatedBy: string } };
    };
    expect(firstAudit.action).toBe("company_code_format.saved");
    expect(firstAudit.metadata.mode).toBe("rich");
    expect(firstAudit.after.definition.updatedBy).toBe(ctx.userId);
  });

  it("resets stored settings back to YGEN defaults", async () => {
    seedLegacyRows();
    const modified = loadYgenDefaults(ctx.companyId);
    modified.definitions[0]!.displayName = "Quotes";

    await saveCompanyCodeSettings(ctx, {
      action: "SAVE",
      settings: modified,
    });

    const reset = await resetCompanyCodeSettings(ctx);
    const quotation = reset.settings.definitions.find((definition) => definition.key === "QUOTATION");

    expect(reset.settings.source).toBe("stored");
    expect(quotation?.displayName).toBe("Active Quote Code");
    expect(quotation?.updatedBy).toBe(ctx.userId);
  });
});
