import { RegionalProfileStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const regionalProfileListQuerySchema = paginationSchema.extend({
  countryCode: z.string().trim().optional(),
  status: z.nativeEnum(RegionalProfileStatus).optional(),
});

export const regionalProfileCreateSchema = z.object({
  countryCode: z.string().trim().min(2).max(10),
  profileKey: z.string().trim().min(1).max(80),
  config: z.record(z.string(), z.any()),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const regionalProfileActionSchema = z.object({
  action: z.enum(["ACTIVATE", "DEACTIVATE"]),
  note: z.string().trim().max(500).optional().nullable(),
});
