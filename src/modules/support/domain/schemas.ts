import { QueueStatus, SlaPolicyStatus, TicketPriority, TicketStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const supportQueueListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(QueueStatus).optional(),
});

export const supportQueueCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
});

export const slaPolicyListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(SlaPolicyStatus).optional(),
  queueId: z.string().trim().optional(),
});

export const slaPolicyCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  queueId: z.string().trim().optional().nullable(),
  firstResponseMins: z.number().int().positive(),
  resolutionMins: z.number().int().positive(),
  pauseOnCustomerWait: z.boolean().optional(),
});

export const ticketListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  queueId: z.string().trim().optional(),
  assignedTo: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
});

export const ticketCreateSchema = z.object({
  number: z.string().trim().min(1).max(100),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.MEDIUM),
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  customerId: z.string().trim().optional().nullable(),
  projectId: z.string().trim().optional().nullable(),
  queueId: z.string().trim().optional().nullable(),
  slaPolicyId: z.string().trim().optional().nullable(),
  assignedTo: z.string().trim().max(120).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
});

export const ticketActionSchema = z.object({
  action: z.enum(["ASSIGN", "RESPOND", "RESOLVE", "CLOSE", "REOPEN", "PAUSE", "RESUME"]),
  assignedTo: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});
