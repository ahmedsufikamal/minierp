import { PayslipStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { payslipActionSchema, payslipCreateSchema, payslipListQuerySchema } from "@/modules/payroll/domain/schemas";

type PayslipAction = "GENERATE" | "POST" | "CANCEL";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: PayslipStatus, action: PayslipAction): PayslipStatus {
  const allowed: Record<PayslipAction, PayslipStatus[]> = {
    GENERATE: [PayslipStatus.DRAFT],
    POST: [PayslipStatus.GENERATED],
    CANCEL: [PayslipStatus.DRAFT, PayslipStatus.GENERATED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} payslip from ${current}`);
  }

  switch (action) {
    case "GENERATE":
      return PayslipStatus.GENERATED;
    case "POST":
      return PayslipStatus.POSTED;
    case "CANCEL":
      return PayslipStatus.CANCELLED;
  }
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

async function assertPayrollEntry(companyId: string, payrollEntryId: string | null | undefined): Promise<void> {
  if (!payrollEntryId) return;
  const entry = await prisma.payrollEntry.findFirst({
    where: { id: payrollEntryId, companyId },
    select: { id: true },
  });
  if (!entry) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid payrollEntryId for this company");
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

export async function listPayslips(ctx: PlatformRequestContext, input: unknown) {
  const parsed = payslipListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid payslip query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.PayslipWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.employeeId ? { employeeId: q.employeeId } : {}),
    ...(q.payrollEntryId ? { payrollEntryId: q.payrollEntryId } : {}),
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
    prisma.payslip.findMany({
      where,
      include: {
        payrollEntry: { select: { id: true, number: true, status: true } },
        employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
        salaryStructure: { select: { id: true, name: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.payslip.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createPayslip(ctx: PlatformRequestContext, input: unknown) {
  const parsed = payslipCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid payslip payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  if (payload.periodEnd < payload.periodStart) {
    throw new PlatformError("VALIDATION_ERROR", "periodEnd cannot be before periodStart");
  }

  await Promise.all([
    assertEmployee(ctx.companyId, payload.employeeId),
    assertPayrollEntry(ctx.companyId, payload.payrollEntryId),
    assertSalaryStructure(ctx.companyId, payload.salaryStructureId),
  ]);

  try {
    return await prisma.payslip.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        status: PayslipStatus.DRAFT,
        payrollEntryId: payload.payrollEntryId,
        employeeId: payload.employeeId,
        salaryStructureId: payload.salaryStructureId,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        payDate: payload.payDate,
        grossPayMinor: payload.grossPayMinor,
        deductionsMinor: payload.deductionsMinor,
        netPayMinor: payload.netPayMinor,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        payrollEntry: { select: { id: true, number: true, status: true } },
        employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
        salaryStructure: { select: { id: true, name: true, status: true } },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Payslip number already exists for this company");
    }
    throw error;
  }
}

export async function applyPayslipAction(ctx: PlatformRequestContext, payslipId: string, input: unknown) {
  const parsed = payslipActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid payslip action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, companyId: ctx.companyId },
  });

  if (!payslip) {
    throw new PlatformError("NOT_FOUND", "Payslip not found");
  }

  const nextStatus = assertTransition(payslip.status, payload.action);

  await prisma.payslip.update({
    where: { id: payslip.id },
    data: {
      status: nextStatus,
      postedAt: payload.action === "POST" ? new Date() : payslip.postedAt,
      postedBy: payload.action === "POST" ? ctx.userId : payslip.postedBy,
      notes: payload.note ? [payslip.notes, payload.note].filter(Boolean).join("\n") : payslip.notes,
      updatedBy: ctx.userId,
    },
  });

  return prisma.payslip.findUniqueOrThrow({
    where: { id: payslip.id },
    include: {
      payrollEntry: { select: { id: true, number: true, status: true } },
      employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
      salaryStructure: { select: { id: true, name: true, status: true } },
    },
  });
}
