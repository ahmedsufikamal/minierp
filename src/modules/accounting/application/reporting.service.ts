import { AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

type AccountingReportKey = "trial-balance" | "profit-loss" | "balance-sheet";

type AccountingReportRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  rootType: AccountType;
  debitCents: number;
  creditCents: number;
  balanceCents: number;
};

function parseDate(input?: string | Date): Date | undefined {
  if (!input) return undefined;
  if (input instanceof Date) return input;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function normalizeRootType(input: { rootType: AccountType | null; type: AccountType }): AccountType {
  return input.rootType ?? input.type;
}

export function getBalanceByRootType(rootType: AccountType, debitCents: number, creditCents: number): number {
  if (rootType === AccountType.LIABILITY || rootType === AccountType.EQUITY || rootType === AccountType.INCOME) {
    return creditCents - debitCents;
  }
  return debitCents - creditCents;
}

export async function runAccountingReport(
  ctx: PlatformRequestContext,
  input: {
    reportKey: AccountingReportKey;
    fromDate?: Date;
    toDate?: Date;
    page: number;
    pageSize: number;
  },
) {
  const fromDate = input.fromDate;
  const toDate = input.toDate;
  const skip = (input.page - 1) * input.pageSize;

  const entries = await prisma.gLEntry.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      ...(fromDate || toDate
        ? {
            postingDate: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    include: {
      account: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          rootType: true,
        },
      },
    },
  });

  const byAccount = new Map<string, AccountingReportRow>();
  for (const entry of entries) {
    const rootType = normalizeRootType({ rootType: entry.account.rootType, type: entry.account.type });
    const existing = byAccount.get(entry.accountId);
    if (!existing) {
      byAccount.set(entry.accountId, {
        accountId: entry.accountId,
        accountCode: entry.account.code,
        accountName: entry.account.name,
        accountType: entry.account.type,
        rootType,
        debitCents: entry.debitCents,
        creditCents: entry.creditCents,
        balanceCents: getBalanceByRootType(rootType, entry.debitCents, entry.creditCents),
      });
      continue;
    }
    existing.debitCents += entry.debitCents;
    existing.creditCents += entry.creditCents;
    existing.balanceCents = getBalanceByRootType(rootType, existing.debitCents, existing.creditCents);
  }

  let allRows = [...byAccount.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  if (input.reportKey === "profit-loss") {
    allRows = allRows.filter((row) => row.rootType === AccountType.INCOME || row.rootType === AccountType.EXPENSE);
  } else if (input.reportKey === "balance-sheet") {
    allRows = allRows.filter(
      (row) =>
        row.rootType === AccountType.ASSET ||
        row.rootType === AccountType.LIABILITY ||
        row.rootType === AccountType.EQUITY,
    );
  }

  const total = allRows.length;
  const rows = allRows.slice(skip, skip + input.pageSize);

  const totals = allRows.reduce(
    (acc, row) => {
      acc.debitCents += row.debitCents;
      acc.creditCents += row.creditCents;
      acc.balanceCents += row.balanceCents;
      return acc;
    },
    { debitCents: 0, creditCents: 0, balanceCents: 0 },
  );

  return {
    reportKey: input.reportKey,
    fromDate: fromDate?.toISOString().slice(0, 10) ?? null,
    toDate: toDate?.toISOString().slice(0, 10) ?? null,
    page: input.page,
    pageSize: input.pageSize,
    total,
    rows,
    totals,
  };
}

export async function runAccountingAdapterReport(
  ctx: PlatformRequestContext,
  input: {
    sourceRef: string;
    filters: {
      fromDate?: string;
      toDate?: string;
    };
    page: number;
    pageSize: number;
  },
): Promise<{ rows: unknown[]; total: number }> {
  const keyBySourceRef: Record<string, AccountingReportKey> = {
    "accounting.trial-balance": "trial-balance",
    "accounting.profit-loss": "profit-loss",
    "accounting.balance-sheet": "balance-sheet",
  };

  const reportKey = keyBySourceRef[input.sourceRef];
  if (!reportKey) {
    throw new PlatformError("VALIDATION_ERROR", `Unsupported accounting report source: ${input.sourceRef}`);
  }

  const result = await runAccountingReport(ctx, {
    reportKey,
    fromDate: parseDate(input.filters.fromDate),
    toDate: parseDate(input.filters.toDate),
    page: input.page,
    pageSize: input.pageSize,
  });

  return {
    rows: result.rows,
    total: result.total,
  };
}
