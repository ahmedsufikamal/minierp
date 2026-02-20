import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function mapUniqueError(error: unknown, label: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new PlatformError("CONFLICT", `${label} already exists for this company`);
  }
  throw error;
}

export async function listExchangeRates(
  ctx: PlatformRequestContext,
  input: { fromCurrency?: string; toCurrency?: string; activeOnly: boolean },
) {
  return prisma.accountingExchangeRate.findMany({
    where: {
      companyId: ctx.companyId,
      ...(input.fromCurrency ? { fromCurrency: input.fromCurrency.toUpperCase() } : {}),
      ...(input.toCurrency ? { toCurrency: input.toCurrency.toUpperCase() } : {}),
      ...(input.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function createExchangeRate(
  ctx: PlatformRequestContext,
  input: {
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    effectiveDate: Date;
    isActive?: boolean;
  },
) {
  const fromCurrency = normalizeCode(input.fromCurrency);
  const toCurrency = normalizeCode(input.toCurrency);

  if (fromCurrency === toCurrency && input.rate !== 1) {
    throw new PlatformError("VALIDATION_ERROR", "Same-currency exchange rate must be 1");
  }

  try {
    return await prisma.accountingExchangeRate.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        fromCurrency,
        toCurrency,
        rate: input.rate,
        effectiveDate: input.effectiveDate,
        isActive: input.isActive ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
  } catch (error) {
    mapUniqueError(error, "Exchange rate");
  }
}

export async function listCostCenters(
  ctx: PlatformRequestContext,
  input: { q?: string; includeInactive: boolean },
) {
  return prisma.accountingCostCenter.findMany({
    where: {
      companyId: ctx.companyId,
      ...(input.includeInactive ? {} : { isActive: true }),
      ...(input.q
        ? {
            OR: [
              { code: { contains: input.q, mode: "insensitive" } },
              { name: { contains: input.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      parent: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ code: "asc" }],
  });
}

export async function createCostCenter(
  ctx: PlatformRequestContext,
  input: {
    code: string;
    name: string;
    parentId?: string;
    isActive?: boolean;
  },
) {
  if (input.parentId) {
    const parent = await prisma.accountingCostCenter.findFirst({
      where: {
        id: input.parentId,
        companyId: ctx.companyId,
      },
      select: { id: true },
    });
    if (!parent) {
      throw new PlatformError("VALIDATION_ERROR", "Invalid parent cost center");
    }
  }

  try {
    return await prisma.accountingCostCenter.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        code: normalizeCode(input.code),
        name: input.name.trim(),
        parentId: input.parentId ?? null,
        isActive: input.isActive ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        parent: { select: { id: true, code: true, name: true } },
      },
    });
  } catch (error) {
    mapUniqueError(error, "Cost center");
  }
}

export async function listAccountingDimensions(
  ctx: PlatformRequestContext,
  input: { q?: string; includeInactive: boolean },
) {
  return prisma.accountingDimension.findMany({
    where: {
      companyId: ctx.companyId,
      ...(input.includeInactive ? {} : { isActive: true }),
      ...(input.q
        ? {
            OR: [
              { key: { contains: input.q, mode: "insensitive" } },
              { label: { contains: input.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ key: "asc" }],
  });
}

export async function createAccountingDimension(
  ctx: PlatformRequestContext,
  input: {
    key: string;
    label: string;
    description?: string;
    isActive?: boolean;
  },
) {
  try {
    return await prisma.accountingDimension.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        key: normalizeKey(input.key),
        label: input.label.trim(),
        description: input.description?.trim() || null,
        isActive: input.isActive ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
  } catch (error) {
    mapUniqueError(error, "Accounting dimension");
  }
}
