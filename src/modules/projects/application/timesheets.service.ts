import { Prisma, TimesheetStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { timesheetActionSchema, timesheetCreateSchema, timesheetListQuerySchema } from "@/modules/projects/domain/schemas";

type TimesheetAction = "SUBMIT" | "APPROVE" | "REJECT" | "RESET";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: TimesheetStatus, action: TimesheetAction): TimesheetStatus {
  const allowed: Record<TimesheetAction, TimesheetStatus[]> = {
    SUBMIT: [TimesheetStatus.DRAFT],
    APPROVE: [TimesheetStatus.SUBMITTED],
    REJECT: [TimesheetStatus.SUBMITTED],
    RESET: [TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED, TimesheetStatus.REJECTED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} timesheet from ${current}`);
  }

  switch (action) {
    case "SUBMIT":
      return TimesheetStatus.SUBMITTED;
    case "APPROVE":
      return TimesheetStatus.APPROVED;
    case "REJECT":
      return TimesheetStatus.REJECTED;
    case "RESET":
      return TimesheetStatus.DRAFT;
  }
}

async function assertProject(companyId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
  if (!project) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid projectId for this company");
  }
}

async function assertTask(companyId: string, taskId: string | null | undefined, projectId: string): Promise<void> {
  if (!taskId) return;
  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, companyId, projectId },
    select: { id: true },
  });
  if (!task) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid taskId for this project/company");
  }
}

async function assertSalesInvoice(companyId: string, salesInvoiceId: string | null | undefined): Promise<void> {
  if (!salesInvoiceId) return;
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: salesInvoiceId, companyId },
    select: { id: true },
  });
  if (!invoice) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid salesInvoiceId for this company");
  }
}

export async function listTimesheets(ctx: PlatformRequestContext, input: unknown) {
  const parsed = timesheetListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid timesheet query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.TimesheetWhereInput = {
    companyId: ctx.companyId,
    ...(q.projectId ? { projectId: q.projectId } : {}),
    ...(q.taskId ? { taskId: q.taskId } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.workerRef ? { workerRef: q.workerRef } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.timesheet.findMany({
      where,
      include: {
        project: { select: { id: true, code: true, name: true } },
        task: { select: { id: true, title: true, status: true } },
        salesInvoice: { select: { id: true, number: true, status: true } },
      },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.timesheet.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createTimesheet(ctx: PlatformRequestContext, input: unknown) {
  const parsed = timesheetCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid timesheet payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await Promise.all([
    assertProject(ctx.companyId, payload.projectId),
    assertTask(ctx.companyId, payload.taskId, payload.projectId),
    assertSalesInvoice(ctx.companyId, payload.salesInvoiceId),
  ]);

  return prisma.timesheet.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      projectId: payload.projectId,
      taskId: payload.taskId,
      workerRef: payload.workerRef,
      workDate: payload.workDate ?? new Date(),
      minutes: payload.minutes,
      status: TimesheetStatus.DRAFT,
      notes: payload.notes,
      salesInvoiceId: payload.salesInvoiceId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: {
      project: { select: { id: true, code: true, name: true } },
      task: { select: { id: true, title: true, status: true } },
      salesInvoice: { select: { id: true, number: true, status: true } },
    },
  });
}

export async function applyTimesheetAction(ctx: PlatformRequestContext, timesheetId: string, input: unknown) {
  const parsed = timesheetActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid timesheet action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const timesheet = await prisma.timesheet.findFirst({
    where: { id: timesheetId, companyId: ctx.companyId },
  });

  if (!timesheet) {
    throw new PlatformError("NOT_FOUND", "Timesheet not found");
  }

  const nextStatus = assertTransition(timesheet.status, payload.action);

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: {
      status: nextStatus,
      notes: payload.note ? [timesheet.notes, payload.note].filter(Boolean).join("\n") : timesheet.notes,
      updatedBy: ctx.userId,
    },
  });

  return prisma.timesheet.findUniqueOrThrow({
    where: { id: timesheet.id },
    include: {
      project: { select: { id: true, code: true, name: true } },
      task: { select: { id: true, title: true, status: true } },
      salesInvoice: { select: { id: true, number: true, status: true } },
    },
  });
}
