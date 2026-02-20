import { EmployeeStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { employeeCreateSchema, employeeListQuerySchema } from "@/modules/hr/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertDepartment(
  companyId: string,
  tenantId: string,
  departmentId: string | null | undefined,
): Promise<void> {
  if (!departmentId) return;
  const department = await prisma.setupDepartment.findFirst({
    where: {
      id: departmentId,
      companyId,
      tenantId,
    },
    select: { id: true },
  });
  if (!department) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid departmentId for this company");
  }
}

async function assertDesignation(
  companyId: string,
  tenantId: string,
  designationId: string | null | undefined,
): Promise<void> {
  if (!designationId) return;
  const designation = await prisma.setupDesignation.findFirst({
    where: {
      id: designationId,
      companyId,
      tenantId,
    },
    select: { id: true },
  });
  if (!designation) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid designationId for this company");
  }
}

export async function listEmployees(ctx: PlatformRequestContext, input: unknown) {
  const parsed = employeeListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid employee query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.EmployeeWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.departmentId ? { departmentId: q.departmentId } : {}),
    ...(q.designationId ? { designationId: q.designationId } : {}),
    ...(q.q
      ? {
          OR: [
            { employeeNo: { contains: q.q, mode: "insensitive" } },
            { fullName: { contains: q.q, mode: "insensitive" } },
            { email: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.employee.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createEmployee(ctx: PlatformRequestContext, input: unknown) {
  const parsed = employeeCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid employee payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await Promise.all([
    assertDepartment(ctx.companyId, ctx.tenantId, payload.departmentId),
    assertDesignation(ctx.companyId, ctx.tenantId, payload.designationId),
  ]);

  try {
    return await prisma.employee.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        employeeNo: payload.employeeNo,
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        departmentId: payload.departmentId,
        designationId: payload.designationId,
        dateOfJoining: payload.dateOfJoining,
        status: EmployeeStatus.ACTIVE,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Employee number already exists for this company");
    }
    throw error;
  }
}
