import { PayrollEntryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { payrollEntryActionSchema, payrollEntryCreateSchema, payrollEntryListQuerySchema } from "@/modules/payroll/domain/schemas";

type PayrollEntryAction = "SUBMIT" | "POST" | "CANCEL";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: PayrollEntryStatus, action: PayrollEntryAction): PayrollEntryStatus {
  const allowed: Record<PayrollEntryAction, PayrollEntryStatus[]> = {
    SUBMIT: [PayrollEntryStatus.DRAFT],
    POST: [PayrollEntryStatus.SUBMITTED],
    CANCEL: [PayrollEntryStatus.DRAFT, PayrollEntryStatus.SUBMITTED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} payroll entry from ${current}`);
  }

  switch (action) {
    case "SUBMIT":
      return PayrollEntryStatus.SUBMITTED;
    case "POST":
      return PayrollEntryStatus.POSTED;
    case "CANCEL":
      return PayrollEntryStatus.CANCELLED;
  }
}

async function assertSalaryStructure(companyId: string, salaryStructureId: string | null | undefined): Promise<void> {
  if (!salaryStructureId) return;
  const structure = await prisma.salaryStructure.findFirst({
    where: { id: salaryStructureId, companyId },
    select: { id: true },
  });
  if (!structure) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid salaryStructureId for this company");
  }
}

async function assertAccountingPeriod(
  companyId: string,
  tenantId: string,
  accountingPeriodId: string | null | undefined,
): Promise<void> {
  if (!accountingPeriodId) return;
  const period = await prisma.accountingPeriod.findFirst({
    where: { id: accountingPeriodId, companyId, tenantId },
    select: { id: true },
  });
  if (!period) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid accountingPeriodId for this company");
  }
}

async function assertEmployees(companyId: string, employeeIds: string[]): Promise<void> {
  const uniqueEmployeeIds = [...new Set(employeeIds)];
  const count = await prisma.employee.count({
    where: {
      companyId,
      id: { in: uniqueEmployeeIds },
    },
  });
  if (count !== uniqueEmployeeIds.length) {
    throw new PlatformError("VALIDATION_ERROR", "One or more employee IDs are invalid for this company");
  }
}

export async function listPayrollEntries(ctx: PlatformRequestContext, input: unknown) {
  const parsed = payrollEntryListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid payroll entry query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.PayrollEntryWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
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
    prisma.payrollEntry.findMany({
      where,
      include: {
        salaryStructure: { select: { id: true, name: true, status: true } },
        accountingPeriod: { select: { id: true, name: true, status: true } },
        employees: {
          include: {
            employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
          },
          orderBy: [{ employee: { employeeNo: "asc" } }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.payrollEntry.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createPayrollEntry(ctx: PlatformRequestContext, input: unknown) {
  const parsed = payrollEntryCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid payroll entry payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  if (payload.periodEnd < payload.periodStart) {
    throw new PlatformError("VALIDATION_ERROR", "periodEnd cannot be before periodStart");
  }

  if (payload.payDate < payload.periodStart || payload.payDate > payload.periodEnd) {
    throw new PlatformError("VALIDATION_ERROR", "payDate must be within the payroll period");
  }

  for (const employeeRow of payload.employees) {
    if (employeeRow.netPayMinor !== employeeRow.grossPayMinor - employeeRow.deductionsMinor) {
      throw new PlatformError("VALIDATION_ERROR", "netPayMinor must equal grossPayMinor - deductionsMinor");
    }
  }

  await Promise.all([
    assertSalaryStructure(ctx.companyId, payload.salaryStructureId),
    assertAccountingPeriod(ctx.companyId, ctx.tenantId, payload.accountingPeriodId),
    assertEmployees(
      ctx.companyId,
      payload.employees.map((employee) => employee.employeeId),
    ),
  ]);

  try {
    return await prisma.payrollEntry.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        status: PayrollEntryStatus.DRAFT,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        payDate: payload.payDate,
        salaryStructureId: payload.salaryStructureId,
        accountingPeriodId: payload.accountingPeriodId,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        employees: {
          create: payload.employees.map((employee) => ({
            employeeId: employee.employeeId,
            grossPayMinor: employee.grossPayMinor,
            deductionsMinor: employee.deductionsMinor,
            netPayMinor: employee.netPayMinor,
          })),
        },
      },
      include: {
        salaryStructure: { select: { id: true, name: true, status: true } },
        accountingPeriod: { select: { id: true, name: true, status: true } },
        employees: {
          include: {
            employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
          },
          orderBy: [{ employee: { employeeNo: "asc" } }],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Payroll entry number already exists for this company");
    }
    throw error;
  }
}

export async function applyPayrollEntryAction(ctx: PlatformRequestContext, entryId: string, input: unknown) {
  const parsed = payrollEntryActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid payroll entry action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const entry = await prisma.payrollEntry.findFirst({
    where: { id: entryId, companyId: ctx.companyId },
    include: {
      accountingPeriod: { select: { id: true, status: true } },
    },
  });

  if (!entry) {
    throw new PlatformError("NOT_FOUND", "Payroll entry not found");
  }

  const nextStatus = assertTransition(entry.status, payload.action);

  if (payload.action === "POST" && entry.accountingPeriod && entry.accountingPeriod.status !== "OPEN") {
    throw new PlatformError("CONFLICT", "Cannot post payroll entry in a closed accounting period");
  }

  await prisma.$transaction(async (tx) => {
    await tx.payrollEntry.update({
      where: { id: entry.id },
      data: {
        status: nextStatus,
        postedAt: payload.action === "POST" ? new Date() : entry.postedAt,
        postedBy: payload.action === "POST" ? ctx.userId : entry.postedBy,
        notes: payload.note ? [entry.notes, payload.note].filter(Boolean).join("\n") : entry.notes,
        updatedBy: ctx.userId,
      },
    });

    if (payload.action === "POST") {
      await tx.outboxEvent.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          topic: "payroll.entry.posted",
          aggregateType: "PayrollEntry",
          aggregateId: entry.id,
          payload: {
            payrollEntryId: entry.id,
            postedBy: ctx.userId,
          } as Prisma.InputJsonValue,
        },
      });
    }
  });

  return prisma.payrollEntry.findUniqueOrThrow({
    where: { id: entry.id },
    include: {
      salaryStructure: { select: { id: true, name: true, status: true } },
      accountingPeriod: { select: { id: true, name: true, status: true } },
      employees: {
        include: {
          employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
        },
        orderBy: [{ employee: { employeeNo: "asc" } }],
      },
    },
  });
}
