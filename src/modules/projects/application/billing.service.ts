import { Prisma, ProjectBillingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateSeriesNumber } from "@/modules/platform/application/numbering.service";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  projectBillingActionSchema,
  projectBillingCreateSchema,
  projectBillingListQuerySchema,
} from "@/modules/projects/domain/schemas";

type BillingAction = "MARK_READY" | "MARK_INVOICED" | "CANCEL" | "RESET";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function resolveBillingNumber(ctx: PlatformRequestContext, date: Date): Promise<string> {
  try {
    const allocated = await allocateSeriesNumber(ctx, {
      key: "PBILL",
      companyId: ctx.companyId,
      date,
      fiscalYear: String(date.getUTCFullYear()),
    });
    return allocated.number;
  } catch {
    const yyyy = date.getUTCFullYear();
    const token = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `PBL-${yyyy}-${token}`;
  }
}

async function assertProject(companyId: string, projectId: string): Promise<void> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
  if (!row) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid projectId for this company");
  }
}

async function assertTimesheet(companyId: string, projectId: string, timesheetId: string | null | undefined): Promise<void> {
  if (!timesheetId) return;
  const row = await prisma.timesheet.findFirst({
    where: {
      id: timesheetId,
      companyId,
      projectId,
      status: "APPROVED",
    },
    select: { id: true },
  });
  if (!row) {
    throw new PlatformError("VALIDATION_ERROR", "timesheetId must belong to approved timesheet on this project");
  }
}

async function assertSalesInvoice(companyId: string, salesInvoiceId: string | null | undefined): Promise<void> {
  if (!salesInvoiceId) return;
  const row = await prisma.salesInvoice.findFirst({
    where: { id: salesInvoiceId, companyId },
    select: { id: true },
  });
  if (!row) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid salesInvoiceId for this company");
  }
}

function resolveTransition(current: ProjectBillingStatus, action: BillingAction): ProjectBillingStatus {
  const allowed: Record<BillingAction, ProjectBillingStatus[]> = {
    MARK_READY: [ProjectBillingStatus.DRAFT],
    MARK_INVOICED: [ProjectBillingStatus.READY],
    CANCEL: [ProjectBillingStatus.DRAFT, ProjectBillingStatus.READY],
    RESET: [ProjectBillingStatus.READY, ProjectBillingStatus.CANCELLED, ProjectBillingStatus.INVOICED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} from ${current}`);
  }

  switch (action) {
    case "MARK_READY":
      return ProjectBillingStatus.READY;
    case "MARK_INVOICED":
      return ProjectBillingStatus.INVOICED;
    case "CANCEL":
      return ProjectBillingStatus.CANCELLED;
    case "RESET":
      return ProjectBillingStatus.DRAFT;
  }
}

export async function listProjectBillingEntries(ctx: PlatformRequestContext, input: unknown) {
  const parsed = projectBillingListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid project billing query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.ProjectBillingEntryWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.projectId ? { projectId: q.projectId } : {}),
    ...(q.timesheetId ? { timesheetId: q.timesheetId } : {}),
    ...(q.q
      ? {
          OR: [
            { number: { contains: q.q, mode: "insensitive" } },
            { notes: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.projectBillingEntry.findMany({
      where,
      include: {
        project: { select: { id: true, code: true, name: true } },
        timesheet: { select: { id: true, minutes: true, status: true } },
        salesInvoice: { select: { id: true, number: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.projectBillingEntry.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createProjectBillingEntry(ctx: PlatformRequestContext, input: unknown) {
  const parsed = projectBillingCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid project billing payload", parsed.error.flatten());
  }
  const payload = parsed.data;
  const now = new Date();

  await Promise.all([
    assertProject(ctx.companyId, payload.projectId),
    assertTimesheet(ctx.companyId, payload.projectId, payload.timesheetId),
    assertSalesInvoice(ctx.companyId, payload.salesInvoiceId),
  ]);

  const number = payload.number?.trim() || (await resolveBillingNumber(ctx, now));
  const timesheet = payload.timesheetId
    ? await prisma.timesheet.findUnique({
        where: { id: payload.timesheetId },
        select: { minutes: true },
      })
    : null;

  return prisma.projectBillingEntry.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      number,
      status: ProjectBillingStatus.DRAFT,
      projectId: payload.projectId,
      timesheetId: payload.timesheetId ?? null,
      salesInvoiceId: payload.salesInvoiceId ?? null,
      billableMinutes: payload.billableMinutes ?? timesheet?.minutes ?? 0,
      billAmountCents: payload.billAmountCents,
      currency: payload.currency.toUpperCase(),
      notes: payload.notes ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: {
      project: { select: { id: true, code: true, name: true } },
      timesheet: { select: { id: true, minutes: true, status: true } },
      salesInvoice: { select: { id: true, number: true, status: true } },
    },
  });
}

export async function applyProjectBillingAction(
  ctx: PlatformRequestContext,
  entryId: string,
  input: unknown,
) {
  const parsed = projectBillingActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid project billing action", parsed.error.flatten());
  }

  const payload = parsed.data;
  const row = await prisma.projectBillingEntry.findFirst({
    where: { id: entryId, companyId: ctx.companyId },
  });
  if (!row) {
    throw new PlatformError("NOT_FOUND", "Project billing entry not found");
  }

  if (payload.salesInvoiceId) {
    await assertSalesInvoice(ctx.companyId, payload.salesInvoiceId);
  }

  const nextStatus = resolveTransition(row.status, payload.action);
  const now = new Date();

  return prisma.projectBillingEntry.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      readyAt: payload.action === "MARK_READY" ? now : payload.action === "RESET" ? null : row.readyAt,
      invoicedAt: payload.action === "MARK_INVOICED" ? now : payload.action === "RESET" ? null : row.invoicedAt,
      cancelledAt: payload.action === "CANCEL" ? now : payload.action === "RESET" ? null : row.cancelledAt,
      salesInvoiceId:
        payload.action === "MARK_INVOICED"
          ? payload.salesInvoiceId ?? row.salesInvoiceId
          : payload.action === "RESET"
            ? null
            : row.salesInvoiceId,
      notes: payload.note ? [row.notes, payload.note].filter(Boolean).join("\n") : row.notes,
      updatedBy: ctx.userId,
    },
    include: {
      project: { select: { id: true, code: true, name: true } },
      timesheet: { select: { id: true, minutes: true, status: true } },
      salesInvoice: { select: { id: true, number: true, status: true } },
    },
  });
}
