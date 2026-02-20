import { AccountingPeriodStatus, AccountType, JournalEntryStatus } from "@prisma/client";
import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const accountCreateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(160),
  type: z.nativeEnum(AccountType),
  rootType: z.nativeEnum(AccountType).optional(),
  parentId: z.string().trim().min(1).optional(),
  isGroup: z.boolean().optional(),
});

export const journalLineSchema = z.object({
  accountId: z.string().trim().min(1),
  description: z.string().trim().max(500).optional(),
  debitCents: z.coerce.number().int().min(0).default(0),
  creditCents: z.coerce.number().int().min(0).default(0),
});

export const journalEntryCreateSchema = z.object({
  date: z.coerce.date().optional(),
  postingDate: z.coerce.date().optional(),
  memo: z.string().trim().max(500).optional(),
  lines: z.array(journalLineSchema).min(2),
  submit: z.boolean().optional(),
});

export const journalEntryListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(JournalEntryStatus).optional(),
});

export const journalEntrySubmitSchema = z.object({
  journalEntryId: z.string().trim().min(1),
  postingDate: z.coerce.date().optional(),
});

export const glQuerySchema = paginationQuerySchema.extend({
  accountId: z.string().trim().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export const fiscalYearCreateSchema = z.object({
  name: z.string().trim().min(2).max(40),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isDefault: z.boolean().optional(),
});

export const periodCreateSchema = z.object({
  fiscalYearId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(40),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isYearEnd: z.boolean().optional(),
});

export const periodListQuerySchema = z.object({
  fiscalYearId: z.string().trim().optional(),
});

export const periodUpdateSchema = z.object({
  periodId: z.string().trim().min(1),
  status: z.nativeEnum(AccountingPeriodStatus),
});

export const accountingReportQuerySchema = paginationQuerySchema.extend({
  reportKey: z.enum(["trial-balance", "profit-loss", "balance-sheet"]),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});
