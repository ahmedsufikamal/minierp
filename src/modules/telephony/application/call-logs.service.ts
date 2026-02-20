import { CallStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { callLogActionSchema, callLogCreateSchema, callLogListQuerySchema } from "@/modules/telephony/domain/schemas";

type CallLogAction = "ANSWER" | "MISS" | "VOICEMAIL" | "END";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertQueue(companyId: string, queueId: string | null | undefined): Promise<void> {
  if (!queueId) return;
  const queue = await prisma.supportQueue.findFirst({
    where: { id: queueId, companyId },
    select: { id: true },
  });
  if (!queue) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid queueId for this company");
  }
}

async function assertTicket(companyId: string, ticketId: string | null | undefined): Promise<void> {
  if (!ticketId) return;
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, companyId },
    select: { id: true },
  });
  if (!ticket) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid ticketId for this company");
  }
}

async function assertCustomer(companyId: string, customerId: string | null | undefined): Promise<void> {
  if (!customerId) return;
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });
  if (!customer) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid customerId for this company");
  }
}

function nextStatus(current: CallStatus, action: CallLogAction): CallStatus {
  const allowed: Record<CallLogAction, CallStatus[]> = {
    ANSWER: [CallStatus.RINGING],
    MISS: [CallStatus.RINGING],
    VOICEMAIL: [CallStatus.RINGING],
    END: [CallStatus.RINGING, CallStatus.ANSWERED, CallStatus.VOICEMAIL],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} call from ${current}`);
  }

  switch (action) {
    case "ANSWER":
      return CallStatus.ANSWERED;
    case "MISS":
      return CallStatus.MISSED;
    case "VOICEMAIL":
      return CallStatus.VOICEMAIL;
    case "END":
      return CallStatus.ENDED;
  }
}

export async function listCallLogs(ctx: PlatformRequestContext, input: unknown) {
  const parsed = callLogListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid call log query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.CallLogWhereInput = {
    companyId: ctx.companyId,
    ...(q.queueId ? { queueId: q.queueId } : {}),
    ...(q.ticketId ? { ticketId: q.ticketId } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.direction ? { direction: q.direction } : {}),
    ...(q.status ? { status: q.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.callLog.findMany({
      where,
      include: {
        queue: { select: { id: true, name: true, status: true } },
        ticket: { select: { id: true, number: true, status: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.callLog.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createCallLog(ctx: PlatformRequestContext, input: unknown) {
  const parsed = callLogCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid call log payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await Promise.all([
    assertQueue(ctx.companyId, payload.queueId),
    assertTicket(ctx.companyId, payload.ticketId),
    assertCustomer(ctx.companyId, payload.customerId),
  ]);

  return prisma.callLog.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      queueId: payload.queueId,
      ticketId: payload.ticketId,
      customerId: payload.customerId,
      direction: payload.direction,
      status: payload.status,
      phoneNumber: payload.phoneNumber,
      fromNumber: payload.fromNumber,
      toNumber: payload.toNumber,
      durationSecs: payload.durationSecs,
      notes: payload.notes,
      recordingUrl: payload.recordingUrl,
      startedAt: payload.startedAt ?? new Date(),
      endedAt: payload.endedAt,
      createdBy: ctx.userId,
    },
    include: {
      queue: { select: { id: true, name: true, status: true } },
      ticket: { select: { id: true, number: true, status: true } },
      customer: { select: { id: true, name: true } },
    },
  });
}

export async function applyCallLogAction(ctx: PlatformRequestContext, callLogId: string, input: unknown) {
  const parsed = callLogActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid call action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const call = await prisma.callLog.findFirst({
    where: { id: callLogId, companyId: ctx.companyId },
  });

  if (!call) {
    throw new PlatformError("NOT_FOUND", "Call log not found");
  }

  const now = new Date();
  const status = nextStatus(call.status, payload.action);
  const endedAt = payload.action === "END" || payload.action === "MISS" ? now : call.endedAt;

  const durationSecs =
    payload.durationSecs ??
    (endedAt && call.startedAt
      ? Math.max(Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000), 0)
      : call.durationSecs);

  await prisma.callLog.update({
    where: { id: call.id },
    data: {
      status,
      endedAt,
      durationSecs,
      notes: payload.note ? [call.notes, payload.note].filter(Boolean).join("\n") : call.notes,
    },
  });

  return prisma.callLog.findUniqueOrThrow({
    where: { id: call.id },
    include: {
      queue: { select: { id: true, name: true, status: true } },
      ticket: { select: { id: true, number: true, status: true } },
      customer: { select: { id: true, name: true } },
    },
  });
}
