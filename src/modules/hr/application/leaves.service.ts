import { LeaveApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  leaveAllocationCreateSchema,
  leaveAllocationListQuerySchema,
  leaveApplicationActionSchema,
  leaveApplicationCreateSchema,
  leaveApplicationListQuerySchema,
} from "@/modules/hr/domain/schemas";

type LeaveApplicationAction = "SUBMIT" | "APPROVE" | "REJECT" | "CANCEL";

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

function assertTransition(current: LeaveApplicationStatus, action: LeaveApplicationAction): LeaveApplicationStatus {
  const allowed: Record<LeaveApplicationAction, LeaveApplicationStatus[]> = {
    SUBMIT: [LeaveApplicationStatus.DRAFT],
    APPROVE: [LeaveApplicationStatus.SUBMITTED],
    REJECT: [LeaveApplicationStatus.SUBMITTED],
    CANCEL: [LeaveApplicationStatus.DRAFT, LeaveApplicationStatus.SUBMITTED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} leave application from ${current}`);
  }

  switch (action) {
    case "SUBMIT":
      return LeaveApplicationStatus.SUBMITTED;
    case "APPROVE":
      return LeaveApplicationStatus.APPROVED;
    case "REJECT":
      return LeaveApplicationStatus.REJECTED;
    case "CANCEL":
      return LeaveApplicationStatus.CANCELLED;
  }
}

export async function listLeaveAllocations(ctx: PlatformRequestContext, input: unknown) {
  const parsed = leaveAllocationListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid leave allocation query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.LeaveAllocationWhereInput = {
    companyId: ctx.companyId,
    ...(q.employeeId ? { employeeId: q.employeeId } : {}),
    ...(q.leaveType ? { leaveType: q.leaveType } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.leaveAllocation.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
      },
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.leaveAllocation.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createLeaveAllocation(ctx: PlatformRequestContext, input: unknown) {
  const parsed = leaveAllocationCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid leave allocation payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  if (payload.periodEnd < payload.periodStart) {
    throw new PlatformError("VALIDATION_ERROR", "periodEnd cannot be before periodStart");
  }

  await assertEmployee(ctx.companyId, payload.employeeId);

  return prisma.leaveAllocation.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      employeeId: payload.employeeId,
      leaveType: payload.leaveType,
      totalDays: payload.totalDays,
      usedDays: 0,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      notes: payload.notes,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: {
      employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
    },
  });
}

export async function listLeaveApplications(ctx: PlatformRequestContext, input: unknown) {
  const parsed = leaveApplicationListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid leave application query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.LeaveApplicationWhereInput = {
    companyId: ctx.companyId,
    ...(q.employeeId ? { employeeId: q.employeeId } : {}),
    ...(q.status ? { status: q.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.leaveApplication.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.leaveApplication.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createLeaveApplication(ctx: PlatformRequestContext, input: unknown) {
  const parsed = leaveApplicationCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid leave application payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  if (payload.toDate < payload.fromDate) {
    throw new PlatformError("VALIDATION_ERROR", "toDate cannot be before fromDate");
  }

  await assertEmployee(ctx.companyId, payload.employeeId);

  return prisma.leaveApplication.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      employeeId: payload.employeeId,
      leaveType: payload.leaveType,
      fromDate: payload.fromDate,
      toDate: payload.toDate,
      totalDays: payload.totalDays,
      status: LeaveApplicationStatus.DRAFT,
      reason: payload.reason,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: {
      employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
    },
  });
}

export async function applyLeaveApplicationAction(
  ctx: PlatformRequestContext,
  applicationId: string,
  input: unknown,
) {
  const parsed = leaveApplicationActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid leave action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const application = await prisma.leaveApplication.findFirst({
    where: { id: applicationId, companyId: ctx.companyId },
  });

  if (!application) {
    throw new PlatformError("NOT_FOUND", "Leave application not found");
  }

  const nextStatus = assertTransition(application.status, payload.action);

  await prisma.$transaction(async (tx) => {
    if (payload.action === "APPROVE") {
      const allocation = await tx.leaveAllocation.findFirst({
        where: {
          companyId: ctx.companyId,
          employeeId: application.employeeId,
          leaveType: application.leaveType,
          periodStart: { lte: application.fromDate },
          periodEnd: { gte: application.toDate },
        },
        orderBy: [{ periodStart: "asc" }],
      });

      if (!allocation) {
        throw new PlatformError("CONFLICT", "No leave allocation found for this employee/leave type/period");
      }

      const remaining = allocation.totalDays - allocation.usedDays;
      if (remaining < application.totalDays) {
        throw new PlatformError("CONFLICT", "Insufficient leave balance for approval");
      }

      await tx.leaveAllocation.update({
        where: { id: allocation.id },
        data: {
          usedDays: allocation.usedDays + application.totalDays,
          updatedBy: ctx.userId,
        },
      });
    }

    await tx.leaveApplication.update({
      where: { id: application.id },
      data: {
        status: nextStatus,
        approvedBy: payload.action === "APPROVE" ? ctx.userId : application.approvedBy,
        approvedAt: payload.action === "APPROVE" ? new Date() : application.approvedAt,
        reason: payload.note ? [application.reason, payload.note].filter(Boolean).join("\n") : application.reason,
        updatedBy: ctx.userId,
      },
    });
  });

  return prisma.leaveApplication.findUniqueOrThrow({
    where: { id: application.id },
    include: {
      employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
    },
  });
}
