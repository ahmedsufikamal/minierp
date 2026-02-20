import { CommunicationChannel, CommunicationDirection, CommunicationStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const communicationWindowListQuerySchema = paginationSchema.extend({
  queueId: z.string().trim().optional(),
  channel: z.nativeEnum(CommunicationChannel).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const communicationWindowCreateSchema = z.object({
  queueId: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  channel: z.nativeEnum(CommunicationChannel),
  timezone: z.string().trim().min(1).max(80).default("UTC"),
  startsAt: z.string().trim().min(1).max(10),
  endsAt: z.string().trim().min(1).max(10),
  isActive: z.boolean().optional(),
});

export const communicationLogListQuerySchema = paginationSchema.extend({
  queueId: z.string().trim().optional(),
  ticketId: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  channel: z.nativeEnum(CommunicationChannel).optional(),
  direction: z.nativeEnum(CommunicationDirection).optional(),
  status: z.nativeEnum(CommunicationStatus).optional(),
});

export const communicationLogCreateSchema = z.object({
  queueId: z.string().trim().optional().nullable(),
  ticketId: z.string().trim().optional().nullable(),
  customerId: z.string().trim().optional().nullable(),
  channel: z.nativeEnum(CommunicationChannel),
  direction: z.nativeEnum(CommunicationDirection),
  status: z.nativeEnum(CommunicationStatus).default(CommunicationStatus.DRAFT),
  subject: z.string().trim().max(200).optional().nullable(),
  body: z.string().trim().max(5000).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
  occurredAt: z.coerce.date().optional().nullable(),
});
