import { CapaStatus, QualityGoalStatus, QualityInspectionStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const qualityInspectionListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(QualityInspectionStatus).optional(),
  referenceType: z.string().trim().optional(),
  referenceId: z.string().trim().optional(),
});

export const qualityInspectionCreateSchema = z.object({
  number: z.string().trim().min(1).max(100),
  referenceType: z.string().trim().min(1).max(120),
  referenceId: z.string().trim().min(1).max(120),
  itemId: z.string().trim().optional().nullable(),
  qtyInspected: z.number().int().nonnegative().default(0),
  qtyAccepted: z.number().int().nonnegative().default(0),
  qtyRejected: z.number().int().nonnegative().default(0),
  inspectedAt: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const qualityInspectionActionSchema = z.object({
  action: z.enum(["SUBMIT", "PASS", "FAIL", "CANCEL"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const qualityCapaListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(CapaStatus).optional(),
  inspectionId: z.string().trim().optional(),
});

export const qualityCapaCreateSchema = z.object({
  inspectionId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  rootCause: z.string().trim().max(2000).optional().nullable(),
  correctiveAction: z.string().trim().max(2000).optional().nullable(),
  preventiveAction: z.string().trim().max(2000).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export const qualityCapaActionSchema = z.object({
  action: z.enum(["START", "CLOSE", "REOPEN"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const qualityGoalListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(QualityGoalStatus).optional(),
});

export const qualityGoalCreateSchema = z.object({
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  metric: z.string().trim().min(1).max(120),
  targetValue: z.coerce.number().nonnegative(),
  currentValue: z.coerce.number().nonnegative().optional(),
  startDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  ownerRef: z.string().trim().max(120).optional().nullable(),
});

export const qualityGoalActionSchema = z.object({
  action: z.enum(["ACTIVATE", "ACHIEVE", "CLOSE", "CANCEL", "RESET", "UPDATE_PROGRESS", "LOG_FEEDBACK"]),
  currentValue: z.coerce.number().nonnegative().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comments: z.string().trim().max(1000).optional().nullable(),
});
