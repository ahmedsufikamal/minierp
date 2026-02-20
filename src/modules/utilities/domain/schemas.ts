import { UtilityTaskStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const utilityTaskListQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(UtilityTaskStatus).optional(),
  q: z.string().trim().optional(),
});

export const utilityTaskCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  input: z.record(z.string(), z.any()).optional().nullable(),
});

export const utilityTaskActionSchema = z.object({
  action: z.enum(["START", "COMPLETE", "FAIL", "CANCEL"]),
  output: z.record(z.string(), z.any()).optional().nullable(),
  error: z.string().trim().max(500).optional().nullable(),
});
