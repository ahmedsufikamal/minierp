import { PortalConfigStatus, PortalPartyType } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const portalConfigListQuerySchema = paginationSchema.extend({
  partyType: z.nativeEnum(PortalPartyType).optional(),
  status: z.nativeEnum(PortalConfigStatus).optional(),
});

export const portalConfigCreateSchema = z.object({
  partyType: z.nativeEnum(PortalPartyType),
  key: z.string().trim().min(1).max(120),
  filters: z.record(z.string(), z.any()).optional().nullable(),
  attributes: z.record(z.string(), z.any()).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const portalConfigActionSchema = z.object({
  action: z.enum(["ACTIVATE", "DEACTIVATE"]),
  note: z.string().trim().max(500).optional().nullable(),
});
