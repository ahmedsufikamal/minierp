import { BulkJobStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const bulkJobListQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(BulkJobStatus).optional(),
  q: z.string().trim().optional(),
});

export const bulkJobItemSchema = z.object({
  itemKey: z.string().trim().min(1).max(120),
  status: z.string().trim().min(1).max(40).default("PENDING"),
  message: z.string().trim().max(500).optional().nullable(),
  payload: z.record(z.string(), z.any()).optional().nullable(),
});

export const bulkJobCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  payload: z.record(z.string(), z.any()).optional().nullable(),
  items: z.array(bulkJobItemSchema).min(1),
});

export const bulkJobActionSchema = z.object({
  action: z.enum(["RUN", "CANCEL"]),
  result: z.record(z.string(), z.any()).optional().nullable(),
  error: z.string().trim().max(500).optional().nullable(),
});
