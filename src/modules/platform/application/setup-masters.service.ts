import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

type SetupListInput = {
  q?: string;
  includeInactive?: boolean;
};

type SetupBaseInput = {
  name: string;
  isActive?: boolean;
};

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function mapUniqueError(error: unknown, entityLabel: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new PlatformError("CONFLICT", `${entityLabel} already exists for this company`);
  }
  throw error;
}

function listWhere(
  ctx: PlatformRequestContext,
  input: SetupListInput,
): { tenantId: string; companyId: string; isActive?: boolean; name?: { contains: string; mode: "insensitive" } } {
  const q = input.q?.trim();
  return {
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    ...(input.includeInactive ? {} : { isActive: true }),
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };
}

async function assertParentRecord(
  parentId: string | null | undefined,
  companyId: string,
  tenantId: string,
  entityName: "setupItemGroup" | "setupTerritory" | "setupCustomerGroup" | "setupSupplierGroup",
  label: string,
) {
  if (!parentId) return;

  const parent = await prisma[entityName].findFirst({
    where: { id: parentId, companyId, tenantId },
    select: { id: true },
  });

  if (!parent) {
    throw new PlatformError("VALIDATION_ERROR", `${label} parent does not exist in this company`);
  }
}

export async function listSetupItemGroups(ctx: PlatformRequestContext, input: SetupListInput) {
  return prisma.setupItemGroup.findMany({
    where: listWhere(ctx, input),
    include: {
      parent: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function createSetupItemGroup(
  ctx: PlatformRequestContext,
  input: SetupBaseInput & { parentId?: string | null; isGroup?: boolean },
) {
  await assertParentRecord(input.parentId ?? null, ctx.companyId, ctx.tenantId, "setupItemGroup", "Item group");

  try {
    return await prisma.setupItemGroup.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: normalizeName(input.name),
        parentId: input.parentId ?? null,
        isGroup: input.isGroup ?? false,
        isActive: input.isActive ?? true,
      },
    });
  } catch (error) {
    mapUniqueError(error, "Item group");
  }
}

export async function listSetupUoms(ctx: PlatformRequestContext, input: SetupListInput) {
  return prisma.setupUom.findMany({
    where: listWhere(ctx, input),
    orderBy: [{ name: "asc" }],
  });
}

export async function createSetupUom(
  ctx: PlatformRequestContext,
  input: SetupBaseInput & { symbol?: string | null; mustBeWholeNumber?: boolean },
) {
  try {
    return await prisma.setupUom.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: normalizeName(input.name),
        symbol: input.symbol?.trim() || null,
        mustBeWholeNumber: input.mustBeWholeNumber ?? false,
        isActive: input.isActive ?? true,
      },
    });
  } catch (error) {
    mapUniqueError(error, "UOM");
  }
}

export async function listSetupTerritories(ctx: PlatformRequestContext, input: SetupListInput) {
  return prisma.setupTerritory.findMany({
    where: listWhere(ctx, input),
    include: {
      parent: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function createSetupTerritory(
  ctx: PlatformRequestContext,
  input: SetupBaseInput & { parentId?: string | null },
) {
  await assertParentRecord(input.parentId ?? null, ctx.companyId, ctx.tenantId, "setupTerritory", "Territory");

  try {
    return await prisma.setupTerritory.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: normalizeName(input.name),
        parentId: input.parentId ?? null,
        isActive: input.isActive ?? true,
      },
    });
  } catch (error) {
    mapUniqueError(error, "Territory");
  }
}

export async function listSetupCustomerGroups(ctx: PlatformRequestContext, input: SetupListInput) {
  return prisma.setupCustomerGroup.findMany({
    where: listWhere(ctx, input),
    include: {
      parent: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function createSetupCustomerGroup(
  ctx: PlatformRequestContext,
  input: SetupBaseInput & { parentId?: string | null },
) {
  await assertParentRecord(
    input.parentId ?? null,
    ctx.companyId,
    ctx.tenantId,
    "setupCustomerGroup",
    "Customer group",
  );

  try {
    return await prisma.setupCustomerGroup.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: normalizeName(input.name),
        parentId: input.parentId ?? null,
        isActive: input.isActive ?? true,
      },
    });
  } catch (error) {
    mapUniqueError(error, "Customer group");
  }
}

export async function listSetupSupplierGroups(ctx: PlatformRequestContext, input: SetupListInput) {
  return prisma.setupSupplierGroup.findMany({
    where: listWhere(ctx, input),
    include: {
      parent: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function createSetupSupplierGroup(
  ctx: PlatformRequestContext,
  input: SetupBaseInput & { parentId?: string | null },
) {
  await assertParentRecord(
    input.parentId ?? null,
    ctx.companyId,
    ctx.tenantId,
    "setupSupplierGroup",
    "Supplier group",
  );

  try {
    return await prisma.setupSupplierGroup.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: normalizeName(input.name),
        parentId: input.parentId ?? null,
        isActive: input.isActive ?? true,
      },
    });
  } catch (error) {
    mapUniqueError(error, "Supplier group");
  }
}
