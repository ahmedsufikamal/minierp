import { EdiTransportStatus, EdiTransportType } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const ediCodeListQuerySchema = paginationSchema.extend({
  listType: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const ediCodeListCreateSchema = z.object({
  listType: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(200),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export const ediTransportQuerySchema = paginationSchema.extend({
  type: z.nativeEnum(EdiTransportType).optional(),
  status: z.nativeEnum(EdiTransportStatus).optional(),
});

export const ediTransportCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.nativeEnum(EdiTransportType),
  config: z.record(z.string(), z.any()),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const ediTransportActionSchema = z.object({
  action: z.enum(["ACTIVATE", "DEACTIVATE"]),
});
