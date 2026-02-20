import { JournalEntryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendAuditEvent, appendImmutableLedgerEvent, enqueueOutboxEvent } from "@/modules/platform/application/audit-ledger.service";
import { allocateSeriesNumber } from "@/modules/platform/application/numbering.service";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { resolvePostingPeriod } from "@/modules/accounting/application/fiscal-period.service";
import { summarizeJournalLines, type JournalLineInput } from "@/modules/accounting/application/invariants";

function normalizeLines(lines: JournalLineInput[]): JournalLineInput[] {
  return lines.map((line) => ({
    accountId: line.accountId,
    description: line.description ?? null,
    debitCents: Math.max(0, Math.trunc(line.debitCents || 0)),
    creditCents: Math.max(0, Math.trunc(line.creditCents || 0)),
  }));
}

export async function listJournalEntries(
  ctx: PlatformRequestContext,
  input: {
    page: number;
    pageSize: number;
    status?: JournalEntryStatus;
  },
) {
  const skip = (input.page - 1) * input.pageSize;
  const where = {
    companyId: ctx.companyId,
    ...(input.status ? { status: input.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          orderBy: { lineNo: "asc" },
          include: {
            account: {
              select: { id: true, code: true, name: true, type: true, rootType: true },
            },
          },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take: input.pageSize,
    }),
    prisma.journalEntry.count({ where }),
  ]);

  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    rows,
  };
}

export async function createJournalEntryDraft(
  ctx: PlatformRequestContext,
  input: {
    date?: Date;
    postingDate?: Date;
    memo?: string;
    lines: JournalLineInput[];
    submit?: boolean;
  },
) {
  const lines = normalizeLines(input.lines);
  const totals = summarizeJournalLines(lines);

  const accountIds = [...new Set(lines.map((line) => line.accountId))];
  const accounts = await prisma.account.findMany({
    where: {
      companyId: ctx.companyId,
      id: { in: accountIds },
    },
    select: { id: true },
  });

  if (accounts.length !== accountIds.length) {
    throw new PlatformError("VALIDATION_ERROR", "One or more journal line accounts do not exist");
  }

  const entry = await prisma.journalEntry.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      date: input.date ?? new Date(),
      postingDate: input.postingDate ?? null,
      memo: input.memo ?? null,
      totalDebitCents: totals.totalDebitCents,
      totalCreditCents: totals.totalCreditCents,
      lines: {
        create: lines.map((line, index) => ({
          lineNo: index + 1,
          accountId: line.accountId,
          description: line.description ?? null,
          debitCents: line.debitCents,
          creditCents: line.creditCents,
        })),
      },
    },
    include: {
      lines: true,
    },
  });

  await appendAuditEvent(ctx, {
    source: "accounting",
    action: "journal_entry.created",
    entityType: "JournalEntry",
    entityId: entry.id,
    after: {
      id: entry.id,
      date: entry.date,
      totalDebitCents: entry.totalDebitCents,
      totalCreditCents: entry.totalCreditCents,
    },
  });

  if (input.submit) {
    return submitJournalEntry(ctx, {
      journalEntryId: entry.id,
      postingDate: input.postingDate,
    });
  }

  return entry;
}

export async function submitJournalEntry(
  ctx: PlatformRequestContext,
  input: {
    journalEntryId: string;
    postingDate?: Date;
  },
) {
  const entry = await prisma.journalEntry.findFirst({
    where: {
      id: input.journalEntryId,
      companyId: ctx.companyId,
    },
    include: {
      lines: {
        orderBy: { lineNo: "asc" },
      },
      glEntries: {
        select: { id: true },
      },
    },
  });

  if (!entry) {
    throw new PlatformError("NOT_FOUND", "Journal entry not found");
  }

  if (entry.status === JournalEntryStatus.CANCELLED) {
    throw new PlatformError("VALIDATION_ERROR", "Cancelled journal entry cannot be submitted");
  }

  if (entry.status === JournalEntryStatus.SUBMITTED) {
    return entry;
  }

  if (entry.glEntries.length > 0) {
    throw new PlatformError("VALIDATION_ERROR", "Journal entry already has posted GL rows");
  }

  const totals = summarizeJournalLines(
    entry.lines.map((line) => ({
      accountId: line.accountId,
      description: line.description,
      debitCents: line.debitCents,
      creditCents: line.creditCents,
    })),
  );

  const postingDate = input.postingDate ?? entry.postingDate ?? entry.date;
  const periodContext = await resolvePostingPeriod(ctx, postingDate);

  const allocation = entry.number
    ? null
    : await allocateSeriesNumber(ctx, {
        key: "JE",
        companyId: ctx.companyId,
        fiscalYear: periodContext.fiscalYear.name,
        date: periodContext.postingDate,
      });

  const posted = await prisma.$transaction(async (tx) => {
    await tx.gLEntry.createMany({
      data: entry.lines.map((line) => ({
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        postingDate: periodContext.postingDate,
        accountId: line.accountId,
        journalEntryId: entry.id,
        fiscalYearId: periodContext.fiscalYear.id,
        accountingPeriodId: periodContext.period.id,
        debitCents: line.debitCents,
        creditCents: line.creditCents,
        currency: "USD",
        voucherType: "JOURNAL_ENTRY",
        voucherId: entry.id,
        remarks: entry.memo ?? null,
        metadata: { lineNo: line.lineNo } as never,
        createdBy: ctx.userId,
      })),
    });

    return tx.journalEntry.update({
      where: { id: entry.id },
      data: {
        number: allocation?.number ?? entry.number,
        postingDate: periodContext.postingDate,
        status: JournalEntryStatus.SUBMITTED,
        submittedAt: new Date(),
        submittedBy: ctx.userId,
        postedAt: new Date(),
        postedBy: ctx.userId,
        fiscalYearId: periodContext.fiscalYear.id,
        accountingPeriodId: periodContext.period.id,
        totalDebitCents: totals.totalDebitCents,
        totalCreditCents: totals.totalCreditCents,
      },
      include: {
        lines: true,
      },
    });
  });

  await appendAuditEvent(ctx, {
    source: "accounting",
    action: "journal_entry.submitted",
    entityType: "JournalEntry",
    entityId: posted.id,
    before: {
      status: entry.status,
      postedAt: entry.postedAt,
    },
    after: {
      status: posted.status,
      postedAt: posted.postedAt,
      number: posted.number,
      totalDebitCents: posted.totalDebitCents,
      totalCreditCents: posted.totalCreditCents,
    },
  });

  await appendImmutableLedgerEvent(ctx, {
    stream: "accounting",
    eventType: "JOURNAL_ENTRY_POSTED",
    entityType: "JournalEntry",
    entityId: posted.id,
    payload: {
      number: posted.number,
      postingDate: posted.postingDate?.toISOString().slice(0, 10) ?? null,
      fiscalYearId: posted.fiscalYearId,
      accountingPeriodId: posted.accountingPeriodId,
      totals: {
        debitCents: posted.totalDebitCents,
        creditCents: posted.totalCreditCents,
      },
      lineCount: posted.lines.length,
    },
  });

  await enqueueOutboxEvent(ctx, {
    topic: "accounting.journal_entry.submitted",
    aggregateType: "JournalEntry",
    aggregateId: posted.id,
    payload: {
      journalEntryId: posted.id,
      number: posted.number,
      companyId: ctx.companyId,
      tenantId: ctx.tenantId,
      postedAt: posted.postedAt?.toISOString() ?? null,
    },
  });

  return posted;
}

export async function listGLEntries(
  ctx: PlatformRequestContext,
  input: {
    page: number;
    pageSize: number;
    accountId?: string;
    fromDate?: Date;
    toDate?: Date;
  },
) {
  const skip = (input.page - 1) * input.pageSize;
  const where = {
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    ...(input.accountId ? { accountId: input.accountId } : {}),
    ...(input.fromDate || input.toDate
      ? {
          postingDate: {
            ...(input.fromDate ? { gte: input.fromDate } : {}),
            ...(input.toDate ? { lte: input.toDate } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.gLEntry.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            rootType: true,
          },
        },
      },
      orderBy: [{ postingDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: input.pageSize,
    }),
    prisma.gLEntry.count({ where }),
  ]);

  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    rows,
  };
}
