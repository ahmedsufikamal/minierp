import { AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { defaultChartOfAccountsCodes, defaultChartOfAccountsTemplate } from "@/modules/accounting/domain/default-chart-of-accounts";

export async function listAccounts(ctx: PlatformRequestContext) {
  return prisma.account.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ code: "asc" }],
  });
}

export async function createAccount(
  ctx: PlatformRequestContext,
  input: {
    code: string;
    name: string;
    type: AccountType;
    rootType?: AccountType;
    parentId?: string;
    isGroup?: boolean;
  },
) {
  let resolvedRootType = input.rootType ?? input.type;
  if (input.parentId) {
    const parent = await prisma.account.findFirst({
      where: {
        id: input.parentId,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        rootType: true,
        type: true,
      },
    });
    if (!parent) {
      throw new PlatformError("NOT_FOUND", "Parent account not found");
    }
    resolvedRootType = parent.rootType ?? parent.type;
  }

  return prisma.account.create({
    data: {
      companyId: ctx.companyId,
      tenantId: ctx.tenantId,
      code: input.code,
      name: input.name,
      type: input.type,
      rootType: resolvedRootType,
      parentId: input.parentId ?? null,
      isGroup: input.isGroup ?? false,
    },
  });
}

export type ChartOfAccountsSyncSummary = {
  created: number;
  updated: number;
  unchanged: number;
  skippedNonTemplate: number;
};

export async function syncDefaultChartOfAccounts(
  ctx: PlatformRequestContext,
): Promise<ChartOfAccountsSyncSummary> {
  return prisma.$transaction(async (tx) => {
    const existingAccounts = await tx.account.findMany({
      where: { companyId: ctx.companyId },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        rootType: true,
        parentId: true,
        isGroup: true,
      },
    });

    const accountsByCode = new Map(existingAccounts.map((account) => [account.code, account]));
    const createdCodes = new Set<string>();

    for (const row of defaultChartOfAccountsTemplate) {
      if (accountsByCode.has(row.code)) continue;

      const created = await tx.account.create({
        data: {
          companyId: ctx.companyId,
          tenantId: ctx.tenantId || null,
          code: row.code,
          name: row.name,
          type: row.type,
          rootType: row.rootType,
          isGroup: row.isGroup,
          parentId: row.parentCode ? accountsByCode.get(row.parentCode)?.id ?? null : null,
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          rootType: true,
          parentId: true,
          isGroup: true,
        },
      });

      accountsByCode.set(row.code, created);
      createdCodes.add(row.code);
    }

    let updated = 0;
    let unchanged = 0;

    for (const row of defaultChartOfAccountsTemplate) {
      const account = accountsByCode.get(row.code);
      if (!account) {
        throw new PlatformError("INTERNAL_ERROR", `Failed to resolve synced account '${row.code}'`);
      }

      const expectedParentId = row.parentCode ? accountsByCode.get(row.parentCode)?.id ?? null : null;
      const needsUpdate =
        account.name !== row.name ||
        account.parentId !== expectedParentId ||
        account.isGroup !== row.isGroup;

      if (needsUpdate) {
        const next = await tx.account.update({
          where: { id: account.id },
          data: {
            name: row.name,
            parentId: expectedParentId,
            isGroup: row.isGroup,
          },
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            rootType: true,
            parentId: true,
            isGroup: true,
          },
        });

        accountsByCode.set(row.code, next);

        if (!createdCodes.has(row.code)) {
          updated += 1;
        }
        continue;
      }

      if (!createdCodes.has(row.code)) {
        unchanged += 1;
      }
    }

    return {
      created: createdCodes.size,
      updated,
      unchanged,
      skippedNonTemplate: existingAccounts.filter((account) => !defaultChartOfAccountsCodes.has(account.code)).length,
    };
  });
}

type AccountTreeInput = {
  id: string;
  code: string;
  parentId: string | null;
};

export type AccountTreeRow<T extends AccountTreeInput> = T & {
  depth: number;
  hasChildren: boolean;
};

export function flattenAccountTree<T extends AccountTreeInput>(accounts: T[]): AccountTreeRow<T>[] {
  const childrenByParent = new Map<string | null, T[]>();
  for (const account of accounts) {
    const siblings = childrenByParent.get(account.parentId) ?? [];
    siblings.push(account);
    childrenByParent.set(account.parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((left, right) =>
      left.code.localeCompare(right.code, "en", { numeric: true, sensitivity: "base" }),
    );
  }

  const rows: AccountTreeRow<T>[] = [];
  const visited = new Set<string>();

  const visit = (parentId: string | null, depth: number) => {
    const siblings = childrenByParent.get(parentId) ?? [];
    for (const account of siblings) {
      if (visited.has(account.id)) continue;
      visited.add(account.id);
      rows.push({
        ...account,
        depth,
        hasChildren: (childrenByParent.get(account.id)?.length ?? 0) > 0,
      });
      visit(account.id, depth + 1);
    }
  };

  visit(null, 0);

  for (const account of accounts) {
    if (visited.has(account.id)) continue;
    rows.push({
      ...account,
      depth: 0,
      hasChildren: (childrenByParent.get(account.id)?.length ?? 0) > 0,
    });
    visit(account.id, 1);
  }

  return rows;
}
