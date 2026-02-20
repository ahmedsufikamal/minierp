import { PayrollEntryStatus, PayslipStatus, SalaryStructureStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const salaryStructureListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(SalaryStructureStatus).optional(),
});

export const salaryStructureCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  currency: z.string().trim().max(10).default("BDT"),
  baseAmountMinor: z.number().int().nonnegative(),
  allowancesMinor: z.number().int().nonnegative().default(0),
  deductionsMinor: z.number().int().nonnegative().default(0),
  effectiveFrom: z.coerce.date().optional().nullable(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

export const payrollEntryListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(PayrollEntryStatus).optional(),
});

export const payrollEntryEmployeeRowSchema = z.object({
  employeeId: z.string().trim().min(1),
  grossPayMinor: z.number().int().nonnegative(),
  deductionsMinor: z.number().int().nonnegative(),
  netPayMinor: z.number().int().nonnegative(),
});

export const payrollEntryCreateSchema = z.object({
  number: z.string().trim().min(1).max(100),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  payDate: z.coerce.date(),
  salaryStructureId: z.string().trim().optional().nullable(),
  accountingPeriodId: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  employees: z.array(payrollEntryEmployeeRowSchema).min(1),
});

export const payrollEntryActionSchema = z.object({
  action: z.enum(["SUBMIT", "POST", "CANCEL"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const payslipListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(PayslipStatus).optional(),
  employeeId: z.string().trim().optional(),
  payrollEntryId: z.string().trim().optional(),
});

export const payslipCreateSchema = z.object({
  number: z.string().trim().min(1).max(100),
  payrollEntryId: z.string().trim().optional().nullable(),
  employeeId: z.string().trim().min(1),
  salaryStructureId: z.string().trim().optional().nullable(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  payDate: z.coerce.date(),
  grossPayMinor: z.number().int().nonnegative(),
  deductionsMinor: z.number().int().nonnegative(),
  netPayMinor: z.number().int().nonnegative(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const payslipActionSchema = z.object({
  action: z.enum(["GENERATE", "POST", "CANCEL"]),
  note: z.string().trim().max(500).optional().nullable(),
});
