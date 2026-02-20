import {
  AttendanceStatus,
  EmployeeStatus,
  ExpenseClaimStatus,
  LeaveApplicationStatus,
} from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const employeeListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(EmployeeStatus).optional(),
  departmentId: z.string().trim().optional(),
  designationId: z.string().trim().optional(),
});

export const employeeCreateSchema = z.object({
  employeeNo: z.string().trim().min(1).max(80),
  fullName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  departmentId: z.string().trim().optional().nullable(),
  designationId: z.string().trim().optional().nullable(),
  dateOfJoining: z.coerce.date(),
});

export const leaveAllocationListQuerySchema = paginationSchema.extend({
  employeeId: z.string().trim().optional(),
  leaveType: z.string().trim().optional(),
});

export const leaveAllocationCreateSchema = z.object({
  employeeId: z.string().trim().min(1),
  leaveType: z.string().trim().min(1).max(80),
  totalDays: z.number().int().positive(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const leaveApplicationListQuerySchema = paginationSchema.extend({
  employeeId: z.string().trim().optional(),
  status: z.nativeEnum(LeaveApplicationStatus).optional(),
});

export const leaveApplicationCreateSchema = z.object({
  employeeId: z.string().trim().min(1),
  leaveType: z.string().trim().min(1).max(80),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  totalDays: z.number().int().positive(),
  reason: z.string().trim().max(2000).optional().nullable(),
});

export const leaveApplicationActionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "CANCEL"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const attendanceListQuerySchema = paginationSchema.extend({
  employeeId: z.string().trim().optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const attendanceCreateSchema = z.object({
  employeeId: z.string().trim().min(1),
  attendanceDate: z.coerce.date(),
  status: z.nativeEnum(AttendanceStatus),
  checkIn: z.coerce.date().optional().nullable(),
  checkOut: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const expenseClaimListQuerySchema = paginationSchema.extend({
  employeeId: z.string().trim().optional(),
  status: z.nativeEnum(ExpenseClaimStatus).optional(),
});

export const expenseClaimCreateSchema = z.object({
  number: z.string().trim().min(1).max(100),
  employeeId: z.string().trim().min(1),
  claimDate: z.coerce.date(),
  amountMinor: z.number().int().positive(),
  currency: z.string().trim().max(10).default("BDT"),
  description: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const expenseClaimActionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "PAY"]),
  note: z.string().trim().max(500).optional().nullable(),
});
