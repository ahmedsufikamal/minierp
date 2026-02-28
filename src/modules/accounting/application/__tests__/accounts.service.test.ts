import { AccountType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

type MockAccount = {
  id: string;
  companyId: string;
  tenantId: string | null;
  code: string;
  name: string;
  type: AccountType;
  rootType: AccountType | null;
  parentId: string | null;
  isGroup: boolean;
};

const state = vi.hoisted(() => ({
  accounts: [] as MockAccount[],
  idCounter: 1,
}));

function selectRow<T extends Record<string, unknown>>(row: T, select?: Record<string, boolean>) {
  if (!select) return { ...row };
  const picked = Object.entries(select)
    .filter(([, enabled]) => enabled)
    .map(([key]) => [key, row[key]]);
  return Object.fromEntries(picked);
}

const prismaMocks = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      account: {
        findMany: async ({
          where,
          select,
        }: {
          where: { companyId: string };
          select?: Record<string, boolean>;
        }) =>
          state.accounts
            .filter((account) => account.companyId === where.companyId)
            .map((account) => selectRow(account, select)),
        create: async ({
          data,
          select,
        }: {
          data: Omit<MockAccount, "id">;
          select?: Record<string, boolean>;
        }) => {
          const created: MockAccount = {
            id: `acct-${state.idCounter++}`,
            ...data,
          };
          state.accounts.push(created);
          return selectRow(created, select);
        },
        update: async ({
          where,
          data,
          select,
        }: {
          where: { id: string };
          data: Partial<MockAccount>;
          select?: Record<string, boolean>;
        }) => {
          const index = state.accounts.findIndex((account) => account.id === where.id);
          if (index < 0) {
            throw new Error(`Unknown account '${where.id}'`);
          }
          state.accounts[index] = {
            ...state.accounts[index],
            ...data,
          };
          return selectRow(state.accounts[index], select);
        },
      },
    };
    return callback(tx);
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: prismaMocks.$transaction,
  },
}));

import { defaultChartOfAccountsTemplate } from "@/modules/accounting/domain/default-chart-of-accounts";
import { flattenAccountTree, syncDefaultChartOfAccounts } from "@/modules/accounting/application/accounts.service";

const ctx: PlatformRequestContext = {
  requestId: "req-1",
  tenantId: "tenant-1",
  companyId: "company-1",
  userId: "user-1",
  role: "OWNER",
  platformRole: "NONE",
  permissions: [],
};

beforeEach(() => {
  state.accounts = [];
  state.idCounter = 1;
  prismaMocks.$transaction.mockClear();
});

describe("default chart of accounts sync", () => {
  it("creates the full template and wires parent-child relationships on an empty company", async () => {
    const result = await syncDefaultChartOfAccounts(ctx);

    expect(result).toEqual({
      created: defaultChartOfAccountsTemplate.length,
      updated: 0,
      unchanged: 0,
      skippedNonTemplate: 0,
    });

    expect(state.accounts).toHaveLength(defaultChartOfAccountsTemplate.length);

    const assets = state.accounts.find((account) => account.code === "1000");
    const currentAssets = state.accounts.find((account) => account.code === "1100-1600");
    const cash = state.accounts.find((account) => account.code === "1110");

    expect(assets).toMatchObject({ isGroup: true, parentId: null });
    expect(currentAssets?.parentId).toBe(assets?.id ?? null);
    expect(cash?.parentId).toBe(state.accounts.find((account) => account.code === "1100")?.id ?? null);
  });

  it("updates matching rows, preserves custom rows, and becomes idempotent on rerun", async () => {
    state.accounts = [
      {
        id: "existing-root",
        companyId: ctx.companyId,
        tenantId: ctx.tenantId,
        code: "1000",
        name: "Legacy Asset Bucket",
        type: AccountType.EXPENSE,
        rootType: AccountType.EXPENSE,
        parentId: "stale-parent",
        isGroup: false,
      },
      {
        id: "custom-leaf",
        companyId: ctx.companyId,
        tenantId: ctx.tenantId,
        code: "9999",
        name: "Custom Account",
        type: AccountType.EXPENSE,
        rootType: AccountType.EXPENSE,
        parentId: null,
        isGroup: false,
      },
    ];
    state.idCounter = 100;

    const firstRun = await syncDefaultChartOfAccounts(ctx);

    expect(firstRun.created).toBe(defaultChartOfAccountsTemplate.length - 1);
    expect(firstRun.updated).toBe(1);
    expect(firstRun.skippedNonTemplate).toBe(1);

    const root = state.accounts.find((account) => account.code === "1000");
    expect(root).toMatchObject({
      name: "Application of Funds (Assets)",
      isGroup: true,
      parentId: null,
      type: AccountType.EXPENSE,
      rootType: AccountType.EXPENSE,
    });

    const custom = state.accounts.find((account) => account.code === "9999");
    expect(custom).toMatchObject({ name: "Custom Account" });

    const secondRun = await syncDefaultChartOfAccounts(ctx);

    expect(secondRun).toEqual({
      created: 0,
      updated: 0,
      unchanged: defaultChartOfAccountsTemplate.length,
      skippedNonTemplate: 1,
    });
  });
});

describe("account tree flattening", () => {
  it("returns depth-first rows with child metadata", () => {
    const rows = flattenAccountTree([
      { id: "leaf", code: "1110", parentId: "group" },
      { id: "root", code: "1000", parentId: null },
      { id: "group", code: "1100", parentId: "root" },
    ]);

    expect(rows.map((row) => ({ id: row.id, depth: row.depth, hasChildren: row.hasChildren }))).toEqual([
      { id: "root", depth: 0, hasChildren: true },
      { id: "group", depth: 1, hasChildren: true },
      { id: "leaf", depth: 2, hasChildren: false },
    ]);
  });
});
