import { AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

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
