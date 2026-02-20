import { ApiTokenStatus, IntegrationEmailStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const emailTemplateListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const emailTemplateCreateSchema = z.object({
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  isActive: z.boolean().optional(),
});

export const emailQueueListQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(IntegrationEmailStatus).optional(),
  toEmail: z.string().trim().optional(),
});

export const emailQueueCreateSchema = z.object({
  templateId: z.string().trim().optional().nullable(),
  toEmail: z.string().trim().email(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  scheduledAt: z.coerce.date().optional().nullable(),
});

export const apiTokenListQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ApiTokenStatus).optional(),
});

export const apiTokenCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  tokenHash: z.string().trim().min(1),
  scopes: z.array(z.string().trim().min(1)).optional(),
  expiresAt: z.coerce.date().optional().nullable(),
});

export const apiTokenActionSchema = z.object({
  action: z.enum(["REVOKE", "ACTIVATE"]),
});
