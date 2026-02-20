import {
  ProjectBillingStatus,
  ProjectStatus,
  ProjectTaskStatus,
  TaskPriority,
  TimesheetStatus,
} from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const projectListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  customerId: z.string().trim().optional(),
});

export const projectCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  customerId: z.string().trim().optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const projectActionSchema = z.object({
  action: z.enum(["START", "HOLD", "COMPLETE", "CANCEL", "REOPEN"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const projectTaskListQuerySchema = paginationSchema.extend({
  projectId: z.string().trim().optional(),
  status: z.nativeEnum(ProjectTaskStatus).optional(),
  assignedTo: z.string().trim().optional(),
});

export const projectTaskCreateSchema = z.object({
  projectId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  assignedTo: z.string().trim().max(120).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  plannedMins: z.number().int().positive().optional().nullable(),
  billable: z.boolean().optional(),
});

export const projectTaskActionSchema = z.object({
  action: z.enum(["START", "DONE", "CANCEL", "REOPEN"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const timesheetListQuerySchema = paginationSchema.extend({
  projectId: z.string().trim().optional(),
  taskId: z.string().trim().optional(),
  status: z.nativeEnum(TimesheetStatus).optional(),
  workerRef: z.string().trim().optional(),
});

export const timesheetCreateSchema = z.object({
  projectId: z.string().trim().min(1),
  taskId: z.string().trim().optional().nullable(),
  workerRef: z.string().trim().max(120).optional().nullable(),
  workDate: z.coerce.date().optional().nullable(),
  minutes: z.number().int().positive(),
  notes: z.string().trim().max(2000).optional().nullable(),
  salesInvoiceId: z.string().trim().optional().nullable(),
});

export const timesheetActionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "RESET"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const projectBillingListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(ProjectBillingStatus).optional(),
  projectId: z.string().trim().optional(),
  timesheetId: z.string().trim().optional(),
});

export const projectBillingCreateSchema = z.object({
  number: z.string().trim().min(1).optional(),
  projectId: z.string().trim().min(1),
  timesheetId: z.string().trim().optional().nullable(),
  salesInvoiceId: z.string().trim().optional().nullable(),
  billableMinutes: z.number().int().min(0).optional(),
  billAmountCents: z.number().int().min(0),
  currency: z.string().trim().length(3).default("USD"),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const projectBillingActionSchema = z.object({
  action: z.enum(["MARK_READY", "MARK_INVOICED", "CANCEL", "RESET"]),
  salesInvoiceId: z.string().trim().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});
