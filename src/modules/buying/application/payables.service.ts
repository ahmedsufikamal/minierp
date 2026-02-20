import { BillStatus, Prisma, SupplierPaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyPaymentEntryAction,
  createPaymentEntry,
} from "@/modules/accounting/application/payment-entries.service";
import { allocateSeriesNumber } from "@/modules/platform/application/numbering.service";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  payablesAgingQuerySchema,
  supplierPaymentActionSchema,
  supplierPaymentCreateSchema,
  supplierPaymentListQuerySchema,
} from "@/modules/buying/domain/schemas";

type SupplierPaymentAction = "SUBMIT" | "POST" | "CANCEL";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function resolveSupplierPaymentNumber(ctx: PlatformRequestContext, paymentDate: Date): Promise<string> {
  try {
    const allocated = await allocateSeriesNumber(ctx, {
      key: "SPAY",
      companyId: ctx.companyId,
      date: paymentDate,
      fiscalYear: String(paymentDate.getUTCFullYear()),
    });
    return allocated.number;
  } catch {
    const yyyy = paymentDate.getUTCFullYear();
    const token = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `SPAY-${yyyy}-${token}`;
  }
}

async function assertVendor(companyId: string, vendorId: string): Promise<void> {
  const row = await prisma.vendor.findFirst({
    where: { id: vendorId, companyId },
    select: { id: true },
  });
  if (!row) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid vendorId for this company");
  }
}

async function assertAccount(companyId: string, accountId: string | null | undefined): Promise<void> {
  if (!accountId) return;
  const row = await prisma.account.findFirst({
    where: { id: accountId, companyId },
    select: { id: true },
  });
  if (!row) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid account for this company");
  }
}

async function assertPurchaseBill(companyId: string, vendorId: string, purchaseBillId: string | null | undefined): Promise<void> {
  if (!purchaseBillId) return;
  const row = await prisma.purchaseBill.findFirst({
    where: { id: purchaseBillId, companyId, vendorId },
    select: { id: true },
  });
  if (!row) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid purchaseBillId for vendor/company");
  }
}

function assertSupplierPaymentTransition(
  current: SupplierPaymentStatus,
  action: SupplierPaymentAction,
): SupplierPaymentStatus {
  const allowed: Record<SupplierPaymentAction, SupplierPaymentStatus[]> = {
    SUBMIT: [SupplierPaymentStatus.DRAFT],
    POST: [SupplierPaymentStatus.SUBMITTED],
    CANCEL: [SupplierPaymentStatus.DRAFT, SupplierPaymentStatus.SUBMITTED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} supplier payment from ${current}`);
  }

  switch (action) {
    case "SUBMIT":
      return SupplierPaymentStatus.SUBMITTED;
    case "POST":
      return SupplierPaymentStatus.POSTED;
    case "CANCEL":
      return SupplierPaymentStatus.CANCELLED;
  }
}

export async function listSupplierPayments(ctx: PlatformRequestContext, input: unknown) {
  const parsed = supplierPaymentListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid supplier payment query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.SupplierPaymentWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.vendorId ? { vendorId: q.vendorId } : {}),
    ...(q.q
      ? {
          OR: [
            { number: { contains: q.q, mode: "insensitive" } },
            { remarks: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.supplierPayment.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        paidFromAccount: { select: { id: true, code: true, name: true } },
        paidToAccount: { select: { id: true, code: true, name: true } },
        paymentEntry: { select: { id: true, number: true, status: true } },
        allocations: {
          include: {
            purchaseBill: { select: { id: true, number: true, status: true } },
          },
          orderBy: [{ createdAt: "asc" }],
        },
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.supplierPayment.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createSupplierPayment(ctx: PlatformRequestContext, input: unknown) {
  const parsed = supplierPaymentCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid supplier payment payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  const paymentDate = payload.paymentDate ?? new Date();
  await Promise.all([
    assertVendor(ctx.companyId, payload.vendorId),
    assertAccount(ctx.companyId, payload.paidFromAccountId),
    assertAccount(ctx.companyId, payload.paidToAccountId),
    ...payload.allocations.map((row) => assertPurchaseBill(ctx.companyId, payload.vendorId, row.purchaseBillId)),
  ]);

  const allocatedTotal = payload.allocations.reduce((sum, row) => sum + row.allocatedAmountCents, 0);
  if (allocatedTotal > payload.paidAmountCents) {
    throw new PlatformError("VALIDATION_ERROR", "Supplier payment allocations exceed paid amount");
  }

  const number = payload.number?.trim() || (await resolveSupplierPaymentNumber(ctx, paymentDate));

  return prisma.supplierPayment.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      number,
      vendorId: payload.vendorId,
      status: SupplierPaymentStatus.DRAFT,
      paymentDate,
      paidAmountCents: payload.paidAmountCents,
      currency: payload.currency.toUpperCase(),
      paidFromAccountId: payload.paidFromAccountId ?? null,
      paidToAccountId: payload.paidToAccountId ?? null,
      remarks: payload.remarks ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
      allocations: {
        create: payload.allocations.map((row) => ({
          purchaseBillId: row.purchaseBillId ?? null,
          allocatedAmountCents: row.allocatedAmountCents,
          notes: row.notes ?? null,
        })),
      },
    },
    include: {
      vendor: { select: { id: true, name: true } },
      paidFromAccount: { select: { id: true, code: true, name: true } },
      paidToAccount: { select: { id: true, code: true, name: true } },
      paymentEntry: { select: { id: true, number: true, status: true } },
      allocations: {
        include: {
          purchaseBill: { select: { id: true, number: true, status: true } },
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });
}

export async function applySupplierPaymentAction(
  ctx: PlatformRequestContext,
  supplierPaymentId: string,
  input: unknown,
) {
  const parsed = supplierPaymentActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid supplier payment action", parsed.error.flatten());
  }

  const payload = parsed.data;
  const row = await prisma.supplierPayment.findFirst({
    where: { id: supplierPaymentId, companyId: ctx.companyId },
    include: { allocations: true },
  });
  if (!row) {
    throw new PlatformError("NOT_FOUND", "Supplier payment not found");
  }

  if (payload.action === "POST" && row.status === SupplierPaymentStatus.POSTED) {
    return prisma.supplierPayment.findUniqueOrThrow({
      where: { id: row.id },
      include: {
        vendor: { select: { id: true, name: true } },
        paidFromAccount: { select: { id: true, code: true, name: true } },
        paidToAccount: { select: { id: true, code: true, name: true } },
        paymentEntry: { select: { id: true, number: true, status: true } },
        allocations: {
          include: { purchaseBill: { select: { id: true, number: true, status: true } } },
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });
  }

  const nextStatus = assertSupplierPaymentTransition(row.status, payload.action);
  const now = new Date();

  if (payload.action === "SUBMIT") {
    return prisma.supplierPayment.update({
      where: { id: row.id },
      data: {
        status: nextStatus,
        submittedAt: now,
        updatedBy: ctx.userId,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        paidFromAccount: { select: { id: true, code: true, name: true } },
        paidToAccount: { select: { id: true, code: true, name: true } },
        paymentEntry: { select: { id: true, number: true, status: true } },
        allocations: {
          include: { purchaseBill: { select: { id: true, number: true, status: true } } },
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });
  }

  if (payload.action === "CANCEL") {
    return prisma.supplierPayment.update({
      where: { id: row.id },
      data: {
        status: nextStatus,
        cancelledAt: now,
        remarks: payload.note ? [row.remarks, payload.note].filter(Boolean).join("\n") : row.remarks,
        updatedBy: ctx.userId,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        paidFromAccount: { select: { id: true, code: true, name: true } },
        paidToAccount: { select: { id: true, code: true, name: true } },
        paymentEntry: { select: { id: true, number: true, status: true } },
        allocations: {
          include: { purchaseBill: { select: { id: true, number: true, status: true } } },
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });
  }

  if (!row.paidFromAccountId || !row.paidToAccountId) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "paidFromAccountId and paidToAccountId are required before posting supplier payment",
    );
  }

  const paymentEntry = await createPaymentEntry(ctx, {
    type: "OUTBOUND",
    partyType: "SUPPLIER",
    partyId: row.vendorId,
    postingDate: row.paymentDate,
    paidAmountCents: row.paidAmountCents,
    sourceCurrency: row.currency,
    targetCurrency: row.currency,
    paidFromAccountId: row.paidFromAccountId,
    paidToAccountId: row.paidToAccountId,
    remarks: payload.note ? [row.remarks, payload.note].filter(Boolean).join("\n") : row.remarks ?? undefined,
    allocations: row.allocations.map((allocation) => ({
      referenceType: "PURCHASE_BILL",
      referenceId: allocation.purchaseBillId ?? allocation.id,
      allocatedAmountCents: allocation.allocatedAmountCents,
      currency: row.currency,
    })),
  });

  await applyPaymentEntryAction(ctx, {
    paymentEntryId: paymentEntry.id,
    action: "SUBMIT",
  });
  const postedPaymentEntry = await applyPaymentEntryAction(ctx, {
    paymentEntryId: paymentEntry.id,
    action: "POST",
  });

  return prisma.supplierPayment.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      postedAt: now,
      paymentEntryId: postedPaymentEntry.id,
      updatedBy: ctx.userId,
    },
    include: {
      vendor: { select: { id: true, name: true } },
      paidFromAccount: { select: { id: true, code: true, name: true } },
      paidToAccount: { select: { id: true, code: true, name: true } },
      paymentEntry: { select: { id: true, number: true, status: true } },
      allocations: {
        include: { purchaseBill: { select: { id: true, number: true, status: true } } },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });
}

export async function getPayablesAging(ctx: PlatformRequestContext, input: unknown) {
  const parsed = payablesAgingQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid payables aging query", parsed.error.flatten());
  }

  const payload = parsed.data;
  const asOfDate = payload.asOfDate ?? new Date();
  const asOfDay = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), asOfDate.getUTCDate()));

  const bills = await prisma.purchaseBill.findMany({
    where: {
      companyId: ctx.companyId,
      status: { not: BillStatus.VOID },
      ...(payload.vendorId ? { vendorId: payload.vendorId } : {}),
    },
    include: {
      vendor: { select: { id: true, name: true } },
      lines: { select: { qty: true, unitPriceCents: true } },
      payments: {
        where: { type: "OUTBOUND" },
        select: { amountCents: true },
      },
      supplierPaymentAllocations: {
        where: { supplierPayment: { status: SupplierPaymentStatus.POSTED } },
        select: { allocatedAmountCents: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { billDate: "asc" }],
  });

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const rows = bills
    .map((bill) => {
      const billTotalCents = bill.lines.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0);
      const paidByPaymentRows = bill.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
      const paidBySupplierPayments = bill.supplierPaymentAllocations.reduce(
        (sum, allocation) => sum + allocation.allocatedAmountCents,
        0,
      );
      const paidCents = paidByPaymentRows + paidBySupplierPayments;
      const outstandingCents = Math.max(0, billTotalCents - paidCents);
      const dueDate = bill.dueDate ?? bill.billDate;
      const daysPastDue = Math.floor((asOfDay.getTime() - dueDate.getTime()) / MS_PER_DAY);

      const buckets = {
        current: 0,
        b1_30: 0,
        b31_60: 0,
        b61_90: 0,
        b90_plus: 0,
      };

      if (daysPastDue <= 0) {
        buckets.current = outstandingCents;
      } else if (daysPastDue <= 30) {
        buckets.b1_30 = outstandingCents;
      } else if (daysPastDue <= 60) {
        buckets.b31_60 = outstandingCents;
      } else if (daysPastDue <= 90) {
        buckets.b61_90 = outstandingCents;
      } else {
        buckets.b90_plus = outstandingCents;
      }

      return {
        billId: bill.id,
        billNumber: bill.number,
        vendorId: bill.vendorId,
        vendorName: bill.vendor.name,
        billDate: bill.billDate,
        dueDate,
        billTotalCents,
        paidCents,
        outstandingCents,
        daysPastDue,
        ...buckets,
      };
    })
    .filter((row) => payload.includeZeroBalance || row.outstandingCents > 0);

  const summary = rows.reduce(
    (acc, row) => {
      acc.totalOutstandingCents += row.outstandingCents;
      acc.currentCents += row.current;
      acc.bucket1To30Cents += row.b1_30;
      acc.bucket31To60Cents += row.b31_60;
      acc.bucket61To90Cents += row.b61_90;
      acc.bucketOver90Cents += row.b90_plus;
      return acc;
    },
    {
      totalOutstandingCents: 0,
      currentCents: 0,
      bucket1To30Cents: 0,
      bucket31To60Cents: 0,
      bucket61To90Cents: 0,
      bucketOver90Cents: 0,
    },
  );

  if (payload.persistSnapshot) {
    await prisma.$transaction(async (tx) => {
      await tx.payableAgingSnapshot.deleteMany({
        where: {
          companyId: ctx.companyId,
          asOfDate: asOfDay,
          ...(payload.vendorId ? { vendorId: payload.vendorId } : {}),
        },
      });

      if (rows.length > 0) {
        await tx.payableAgingSnapshot.createMany({
          data: rows.map((row) => ({
            tenantId: ctx.tenantId,
            companyId: ctx.companyId,
            vendorId: row.vendorId,
            purchaseBillId: row.billId,
            asOfDate: asOfDay,
            currency: "USD",
            bucketCurrentCents: row.current,
            bucket1To30Cents: row.b1_30,
            bucket31To60Cents: row.b31_60,
            bucket61To90Cents: row.b61_90,
            bucketOver90Cents: row.b90_plus,
            totalOutstandingCents: row.outstandingCents,
            createdBy: ctx.userId,
          })),
        });
      }
    });
  }

  return {
    asOfDate: asOfDay,
    summary,
    rows,
  };
}
