import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { communicationLogCreateSchema, communicationLogListQuerySchema } from "@/modules/communication/domain/schemas";

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

export async function listCommunicationLogs(ctx: PlatformRequestContext, input: unknown) {
  const parsed = communicationLogListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid communication log query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.CommunicationLogWhereInput = {
    companyId: ctx.companyId,
    ...(q.queueId ? { queueId: q.queueId } : {}),
    ...(q.ticketId ? { ticketId: q.ticketId } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.channel ? { channel: q.channel } : {}),
    ...(q.direction ? { direction: q.direction } : {}),
    ...(q.status ? { status: q.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.communicationLog.findMany({
      where,
      include: {
        queue: { select: { id: true, name: true, status: true } },
        ticket: { select: { id: true, number: true, status: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.communicationLog.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createCommunicationLog(ctx: PlatformRequestContext, input: unknown) {
  const parsed = communicationLogCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid communication log payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await Promise.all([
    assertQueue(ctx.companyId, payload.queueId),
    assertTicket(ctx.companyId, payload.ticketId),
    assertCustomer(ctx.companyId, payload.customerId),
  ]);

  return prisma.communicationLog.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      queueId: payload.queueId,
      ticketId: payload.ticketId,
      customerId: payload.customerId,
      channel: payload.channel,
      direction: payload.direction,
      status: payload.status,
      subject: payload.subject,
      body: payload.body,
      metadata: (payload.metadata ?? null) as Prisma.InputJsonValue,
      occurredAt: payload.occurredAt ?? new Date(),
      createdBy: ctx.userId,
    },
    include: {
      queue: { select: { id: true, name: true, status: true } },
      ticket: { select: { id: true, number: true, status: true } },
      customer: { select: { id: true, name: true } },
    },
  });
}
