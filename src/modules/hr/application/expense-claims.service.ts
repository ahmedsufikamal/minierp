import { ExpenseClaimStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { expenseClaimActionSchema, expenseClaimCreateSchema, expenseClaimListQuerySchema } from "@/modules/hr/domain/schemas";

type ExpenseClaimAction = "SUBMIT" | "APPROVE" | "REJECT" | "PAY";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: ExpenseClaimStatus, action: ExpenseClaimAction): ExpenseClaimStatus {
  const allowed: Record<ExpenseClaimAction, ExpenseClaimStatus[]> = {
    SUBMIT: [ExpenseClaimStatus.DRAFT],
    APPROVE: [ExpenseClaimStatus.SUBMITTED],
    REJECT: [ExpenseClaimStatus.SUBMITTED],
    PAY: [ExpenseClaimStatus.APPROVED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} expense claim from ${current}`);
  }

  switch (action) {
    case "SUBMIT":
      return ExpenseClaimStatus.SUBMITTED;
    case "APPROVE":
      return ExpenseClaimStatus.APPROVED;
    case "REJECT":
      return ExpenseClaimStatus.REJECTED;
    case "PAY":
      return ExpenseClaimStatus.PAID;
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

export async function listExpenseClaims(ctx: PlatformRequestContext, input: unknown) {
  const parsed = expenseClaimListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid expense claim query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.ExpenseClaimWhereInput = {
    companyId: ctx.companyId,
    ...(q.employeeId ? { employeeId: q.employeeId } : {}),
    ...(q.status ? { status: q.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.expenseClaim.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
      },
      orderBy: [{ claimDate: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.expenseClaim.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createExpenseClaim(ctx: PlatformRequestContext, input: unknown) {
  const parsed = expenseClaimCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid expense claim payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  await assertEmployee(ctx.companyId, payload.employeeId);

  try {
    return await prisma.expenseClaim.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        employeeId: payload.employeeId,
        claimDate: payload.claimDate,
        amountMinor: payload.amountMinor,
        currency: payload.currency,
        description: payload.description,
        status: ExpenseClaimStatus.DRAFT,
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
      throw new PlatformError("CONFLICT", "Expense claim number already exists for this company");
    }
    throw error;
  }
}

export async function applyExpenseClaimAction(ctx: PlatformRequestContext, claimId: string, input: unknown) {
  const parsed = expenseClaimActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid expense claim action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const claim = await prisma.expenseClaim.findFirst({
    where: { id: claimId, companyId: ctx.companyId },
  });

  if (!claim) {
    throw new PlatformError("NOT_FOUND", "Expense claim not found");
  }

  const nextStatus = assertTransition(claim.status, payload.action);

  await prisma.expenseClaim.update({
    where: { id: claim.id },
    data: {
      status: nextStatus,
      approvedBy: payload.action === "APPROVE" ? ctx.userId : claim.approvedBy,
      approvedAt: payload.action === "APPROVE" ? new Date() : claim.approvedAt,
      paidAt: payload.action === "PAY" ? new Date() : claim.paidAt,
      notes: payload.note ? [claim.notes, payload.note].filter(Boolean).join("\n") : claim.notes,
      updatedBy: ctx.userId,
    },
  });

  return prisma.expenseClaim.findUniqueOrThrow({
    where: { id: claim.id },
    include: {
      employee: { select: { id: true, employeeNo: true, fullName: true, status: true } },
    },
  });
}
