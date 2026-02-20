import { MaintenanceScheduleStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const maintenanceScheduleListQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(MaintenanceScheduleStatus).optional(),
  assetId: z.string().trim().optional(),
});

export const maintenanceScheduleCreateSchema = z.object({
  assetId: z.string().trim().min(1),
  subject: z.string().trim().min(1).max(200),
  scheduledOn: z.coerce.date(),
  assignedTo: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const maintenanceScheduleActionSchema = z.object({
  action: z.enum(["START", "COMPLETE", "CANCEL"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const maintenanceVisitListQuerySchema = paginationSchema.extend({
  scheduleId: z.string().trim().optional(),
  assetId: z.string().trim().optional(),
});

export const maintenanceVisitCreateSchema = z.object({
  scheduleId: z.string().trim().min(1),
  assetId: z.string().trim().min(1),
  visitDate: z.coerce.date(),
  technician: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});
