import { Prisma, SalaryStructureStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { salaryStructureCreateSchema, salaryStructureListQuerySchema } from "@/modules/payroll/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export async function listSalaryStructures(ctx: PlatformRequestContext, input: unknown) {
  const parsed = salaryStructureListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid salary structure query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.SalaryStructureWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.salaryStructure.findMany({
      where,
      include: {
        _count: {
          select: {
            payrollEntries: true,
            payslips: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.salaryStructure.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createSalaryStructure(ctx: PlatformRequestContext, input: unknown) {
  const parsed = salaryStructureCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid salary structure payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  if (payload.effectiveFrom && payload.effectiveTo && payload.effectiveTo < payload.effectiveFrom) {
    throw new PlatformError("VALIDATION_ERROR", "effectiveTo cannot be before effectiveFrom");
  }

  try {
    return await prisma.salaryStructure.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: payload.name,
        status: SalaryStructureStatus.ACTIVE,
        currency: payload.currency,
        baseAmountMinor: payload.baseAmountMinor,
        allowancesMinor: payload.allowancesMinor,
        deductionsMinor: payload.deductionsMinor,
        effectiveFrom: payload.effectiveFrom,
        effectiveTo: payload.effectiveTo,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        _count: {
          select: {
            payrollEntries: true,
            payslips: true,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Salary structure name already exists for this company");
    }
    throw error;
  }
}
