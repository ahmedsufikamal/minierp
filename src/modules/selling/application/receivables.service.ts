import { DunningNoticeStatus, InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateSeriesNumber } from "@/modules/platform/application/numbering.service";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  dunningNoticeActionSchema,
  dunningNoticeCreateSchema,
  dunningNoticeListQuerySchema,
  receivablesAgingQuerySchema,
} from "@/modules/selling/domain/schemas";

type DunningAction = "SEND" | "ACKNOWLEDGE" | "RESOLVE" | "CANCEL" | "RESET";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function resolveDunningNumber(ctx: PlatformRequestContext, issuedOn: Date): Promise<string> {
  try {
    const allocated = await allocateSeriesNumber(ctx, {
      key: "DUNNING",
      companyId: ctx.companyId,
      date: issuedOn,
      fiscalYear: String(issuedOn.getUTCFullYear()),
    });
    return allocated.number;
  } catch {
    const yyyy = issuedOn.getUTCFullYear();
    const token = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `DN-${yyyy}-${token}`;
  }
}

async function assertCustomer(companyId: string, customerId: string): Promise<void> {
  const row = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });
  if (!row) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid customerId for this company");
  }
}

async function assertInvoice(
  companyId: string,
  salesInvoiceId: string | null | undefined,
  customerId: string,
): Promise<void> {
  if (!salesInvoiceId) return;
  const row = await prisma.salesInvoice.findFirst({
    where: {
      id: salesInvoiceId,
      companyId,
      customerId,
    },
    select: { id: true },
  });
  if (!row) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid salesInvoiceId for customer/company");
  }
}

function resolveDunningTransition(current: DunningNoticeStatus, action: DunningAction): DunningNoticeStatus {
  const allowed: Record<DunningAction, DunningNoticeStatus[]> = {
    SEND: [DunningNoticeStatus.DRAFT, DunningNoticeStatus.ACKNOWLEDGED],
    ACKNOWLEDGE: [DunningNoticeStatus.SENT],
    RESOLVE: [DunningNoticeStatus.SENT, DunningNoticeStatus.ACKNOWLEDGED],
    CANCEL: [DunningNoticeStatus.DRAFT, DunningNoticeStatus.SENT, DunningNoticeStatus.ACKNOWLEDGED],
    RESET: [DunningNoticeStatus.CANCELLED, DunningNoticeStatus.RESOLVED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} notice from ${current}`);
  }

  switch (action) {
    case "SEND":
      return DunningNoticeStatus.SENT;
    case "ACKNOWLEDGE":
      return DunningNoticeStatus.ACKNOWLEDGED;
    case "RESOLVE":
      return DunningNoticeStatus.RESOLVED;
    case "CANCEL":
      return DunningNoticeStatus.CANCELLED;
    case "RESET":
      return DunningNoticeStatus.DRAFT;
  }
}

export async function listDunningNotices(ctx: PlatformRequestContext, input: unknown) {
  const parsed = dunningNoticeListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid dunning query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.DunningNoticeWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.salesInvoiceId ? { salesInvoiceId: q.salesInvoiceId } : {}),
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
    prisma.dunningNotice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        salesInvoice: { select: { id: true, number: true, dueDate: true, status: true } },
      },
      orderBy: [{ issuedOn: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.dunningNotice.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createDunningNotice(ctx: PlatformRequestContext, input: unknown) {
  const parsed = dunningNoticeCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid dunning payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  const issuedOn = payload.issuedOn ?? new Date();
  await assertCustomer(ctx.companyId, payload.customerId);
  await assertInvoice(ctx.companyId, payload.salesInvoiceId, payload.customerId);

  const number = payload.number?.trim() || (await resolveDunningNumber(ctx, issuedOn));

  return prisma.dunningNotice.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      number,
      customerId: payload.customerId,
      salesInvoiceId: payload.salesInvoiceId ?? null,
      status: DunningNoticeStatus.DRAFT,
      issuedOn,
      dueDate: payload.dueDate ?? null,
      reminderLevel: payload.reminderLevel ?? 1,
      notes: payload.notes ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: {
      customer: { select: { id: true, name: true } },
      salesInvoice: { select: { id: true, number: true, dueDate: true, status: true } },
    },
  });
}

export async function applyDunningNoticeAction(
  ctx: PlatformRequestContext,
  noticeId: string,
  input: unknown,
) {
  const parsed = dunningNoticeActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid dunning action", parsed.error.flatten());
  }

  const payload = parsed.data;
  const row = await prisma.dunningNotice.findFirst({
    where: { id: noticeId, companyId: ctx.companyId },
    include: {
      customer: { select: { id: true, name: true } },
      salesInvoice: { select: { id: true, number: true, dueDate: true, status: true } },
    },
  });

  if (!row) {
    throw new PlatformError("NOT_FOUND", "Dunning notice not found");
  }

  const nextStatus = resolveDunningTransition(row.status, payload.action);
  const now = new Date();

  return prisma.dunningNotice.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      sentAt: payload.action === "SEND" ? now : payload.action === "RESET" ? null : row.sentAt,
      resolvedAt: payload.action === "RESOLVE" ? now : payload.action === "RESET" ? null : row.resolvedAt,
      cancelledAt: payload.action === "CANCEL" ? now : payload.action === "RESET" ? null : row.cancelledAt,
      notes: payload.note ? [row.notes, payload.note].filter(Boolean).join("\n") : row.notes,
      updatedBy: ctx.userId,
    },
    include: {
      customer: { select: { id: true, name: true } },
      salesInvoice: { select: { id: true, number: true, dueDate: true, status: true } },
    },
  });
}

export async function getReceivablesAging(ctx: PlatformRequestContext, input: unknown) {
  const parsed = receivablesAgingQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid receivables aging query", parsed.error.flatten());
  }

  const payload = parsed.data;
  const asOfDate = payload.asOfDate ?? new Date();
  const asOfDay = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), asOfDate.getUTCDate()));

  const invoices = await prisma.salesInvoice.findMany({
    where: {
      companyId: ctx.companyId,
      status: { not: InvoiceStatus.VOID },
      ...(payload.customerId ? { customerId: payload.customerId } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      lines: { select: { qty: true, unitPriceCents: true } },
      payments: {
        where: { type: "INBOUND" },
        select: { amountCents: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { invoiceDate: "asc" }],
  });

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const rows = invoices
    .map((invoice) => {
      const invoiceTotalCents = invoice.lines.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0);
      const paidCents = invoice.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
      const outstandingCents = Math.max(0, invoiceTotalCents - paidCents);
      const dueDate = invoice.dueDate ?? invoice.invoiceDate;
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
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        customerId: invoice.customerId,
        customerName: invoice.customer.name,
        invoiceDate: invoice.invoiceDate,
        dueDate,
        invoiceTotalCents,
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
      await tx.receivableAgingSnapshot.deleteMany({
        where: {
          companyId: ctx.companyId,
          asOfDate: asOfDay,
          ...(payload.customerId ? { customerId: payload.customerId } : {}),
        },
      });

      if (rows.length > 0) {
        await tx.receivableAgingSnapshot.createMany({
          data: rows.map((row) => ({
            tenantId: ctx.tenantId,
            companyId: ctx.companyId,
            customerId: row.customerId,
            salesInvoiceId: row.invoiceId,
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
