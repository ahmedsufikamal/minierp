import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { attendanceCreateSchema, attendanceListQuerySchema } from "@/modules/hr/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertEmployee(companyId: string, employeeId: string): Promise<void> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true },
  });
  if (!employee) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid employeeId for this company");
  }
}

export async function listAttendance(ctx: PlatformRequestContext, input: unknown) {
  const parsed = attendanceListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid attendance query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.AttendanceWhereInput = {
    companyId: ctx.companyId,
    ...(q.employeeId ? { employeeId: q.employeeId } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.dateFrom || q.dateTo
      ? {
          attendanceDate: {
            ...(q.dateFrom ? { gte: q.dateFrom } : {}),
            ...(q.dateTo ? { lte: q.dateTo } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
      },
      orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.attendance.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createAttendance(ctx: PlatformRequestContext, input: unknown) {
  const parsed = attendanceCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid attendance payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  await assertEmployee(ctx.companyId, payload.employeeId);

  if (payload.checkIn && payload.checkOut && payload.checkOut < payload.checkIn) {
    throw new PlatformError("VALIDATION_ERROR", "checkOut cannot be before checkIn");
  }

  try {
    return await prisma.attendance.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        employeeId: payload.employeeId,
        attendanceDate: payload.attendanceDate,
        status: payload.status,
        checkIn: payload.checkIn,
        checkOut: payload.checkOut,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Attendance already exists for this employee/date");
    }
    throw error;
  }
}
