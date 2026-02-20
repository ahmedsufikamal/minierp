import { CallDirection, CallStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const callLogListQuerySchema = paginationSchema.extend({
  queueId: z.string().trim().optional(),
  ticketId: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  direction: z.nativeEnum(CallDirection).optional(),
  status: z.nativeEnum(CallStatus).optional(),
});

export const callLogCreateSchema = z.object({
  queueId: z.string().trim().optional().nullable(),
  ticketId: z.string().trim().optional().nullable(),
  customerId: z.string().trim().optional().nullable(),
  direction: z.nativeEnum(CallDirection),
  status: z.nativeEnum(CallStatus).default(CallStatus.RINGING),
  phoneNumber: z.string().trim().min(1).max(40),
  fromNumber: z.string().trim().max(40).optional().nullable(),
  toNumber: z.string().trim().max(40).optional().nullable(),
  durationSecs: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  recordingUrl: z.string().trim().max(500).optional().nullable(),
  startedAt: z.coerce.date().optional().nullable(),
  endedAt: z.coerce.date().optional().nullable(),
});

export const callLogActionSchema = z.object({
  action: z.enum(["ANSWER", "MISS", "VOICEMAIL", "END"]),
  durationSecs: z.number().int().nonnegative().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});
