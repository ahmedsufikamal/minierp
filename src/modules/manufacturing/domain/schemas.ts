import { BomStatus, JobCardStatus, WorkOrderStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const bomListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(BomStatus).optional(),
  itemId: z.string().trim().optional(),
});

export const bomLineSchema = z.object({
  itemId: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  scrapPct: z.number().int().min(0).max(100).optional().nullable(),
});

export const bomCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  itemId: z.string().trim().min(1),
  quantity: z.number().int().positive().default(1),
  isDefault: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(bomLineSchema).min(1),
});

export const bomActionSchema = z.object({
  action: z.enum(["ACTIVATE", "INACTIVATE", "SET_DEFAULT"]),
});

export const routingListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const routingOperationSchema = z.object({
  lineNo: z.number().int().min(1).optional(),
  operationName: z.string().trim().min(1).max(160),
  workstationId: z.string().trim().optional().nullable(),
  durationMins: z.number().int().positive(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const routingCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  operations: z.array(routingOperationSchema).min(1),
});

export const workOrderListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(WorkOrderStatus).optional(),
  bomId: z.string().trim().optional(),
  itemId: z.string().trim().optional(),
});

export const workOrderCreateSchema = z.object({
  number: z.string().trim().min(1).max(100),
  bomId: z.string().trim().min(1),
  routingId: z.string().trim().optional().nullable(),
  itemId: z.string().trim().min(1),
  qtyPlanned: z.number().int().positive(),
  reservationWarehouseId: z.string().trim().optional().nullable(),
  plannedStart: z.coerce.date().optional().nullable(),
  plannedEnd: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const workOrderActionSchema = z.object({
  action: z.enum(["RELEASE", "START", "COMPLETE", "CANCEL"]),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const jobCardListQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(JobCardStatus).optional(),
  workOrderId: z.string().trim().optional(),
  workstationId: z.string().trim().optional(),
});

export const jobCardCreateSchema = z.object({
  workOrderId: z.string().trim().min(1),
  operationNo: z.number().int().min(1),
  operationName: z.string().trim().min(1).max(160),
  workstationId: z.string().trim().optional().nullable(),
  plannedMins: z.number().int().positive(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const jobCardActionSchema = z.object({
  action: z.enum(["START", "COMPLETE", "CANCEL"]),
  actualMins: z.number().int().positive().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});
