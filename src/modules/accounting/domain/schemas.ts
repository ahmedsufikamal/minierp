import {
  AccountingPeriodStatus,
  AccountType,
  JournalEntryStatus,
  PaymentEntryStatus,
  PaymentType,
} from "@prisma/client";
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

export const paymentAllocationSchema = z.object({
  referenceType: z.string().trim().min(2).max(60),
  referenceId: z.string().trim().min(1).max(120),
  allocatedAmountCents: z.coerce.number().int().positive(),
  currency: z.string().trim().length(3).default("USD"),
  exchangeRate: z.coerce.number().positive().optional(),
});

export const paymentEntryCreateSchema = z.object({
  number: z.string().trim().min(2).max(40).optional(),
  type: z.nativeEnum(PaymentType),
  partyType: z.string().trim().min(2).max(30).optional(),
  partyId: z.string().trim().min(1).max(120).optional(),
  postingDate: z.coerce.date().optional(),
  paidAmountCents: z.coerce.number().int().positive(),
  receivedAmountCents: z.coerce.number().int().positive().optional(),
  sourceCurrency: z.string().trim().length(3).default("USD"),
  targetCurrency: z.string().trim().length(3).default("USD"),
  exchangeRate: z.coerce.number().positive().optional(),
  paidFromAccountId: z.string().trim().min(1).optional(),
  paidToAccountId: z.string().trim().min(1).optional(),
  costCenterId: z.string().trim().min(1).optional(),
  dimensions: z.record(z.string(), z.string().trim().min(1)).optional(),
  remarks: z.string().trim().max(500).optional(),
  allocations: z.array(paymentAllocationSchema).default([]),
});

export const paymentEntryListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(PaymentEntryStatus).optional(),
  type: z.nativeEnum(PaymentType).optional(),
  q: z.string().trim().optional(),
});

export const paymentEntryActionSchema = z.object({
  paymentEntryId: z.string().trim().min(1),
  action: z.enum(["SUBMIT", "POST", "CANCEL"]),
  postingDate: z.coerce.date().optional(),
  remarks: z.string().trim().max(500).optional(),
});

export const exchangeRateCreateSchema = z.object({
  fromCurrency: z.string().trim().length(3),
  toCurrency: z.string().trim().length(3),
  rate: z.coerce.number().positive(),
  effectiveDate: z.coerce.date(),
  isActive: z.boolean().optional(),
});

export const exchangeRateListQuerySchema = z.object({
  fromCurrency: z.string().trim().length(3).optional(),
  toCurrency: z.string().trim().length(3).optional(),
  activeOnly: z.coerce.boolean().optional().default(true),
});

export const costCenterCreateSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(160),
  parentId: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const costCenterListQuerySchema = z.object({
  q: z.string().trim().optional(),
  includeInactive: z.coerce.boolean().optional().default(false),
});

export const accountingDimensionCreateSchema = z.object({
  key: z.string().trim().min(2).max(60),
  label: z.string().trim().min(2).max(160),
  description: z.string().trim().max(300).optional(),
  isActive: z.boolean().optional(),
});

export const accountingDimensionListQuerySchema = z.object({
  q: z.string().trim().optional(),
  includeInactive: z.coerce.boolean().optional().default(false),
});
