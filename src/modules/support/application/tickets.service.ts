import { Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { ticketActionSchema, ticketCreateSchema, ticketListQuerySchema } from "@/modules/support/domain/schemas";

type TicketAction = "ASSIGN" | "RESPOND" | "RESOLVE" | "CLOSE" | "REOPEN" | "PAUSE" | "RESUME";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
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

async function assertProject(companyId: string, projectId: string | null | undefined): Promise<void> {
  if (!projectId) return;
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
  if (!project) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid projectId for this company");
  }
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

async function assertSlaPolicy(companyId: string, slaPolicyId: string | null | undefined): Promise<void> {
  if (!slaPolicyId) return;
  const policy = await prisma.slaPolicy.findFirst({
    where: { id: slaPolicyId, companyId },
    select: { id: true },
  });
  if (!policy) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid slaPolicyId for this company");
  }
}

function assertActionAllowed(ticket: { status: TicketStatus; pauseStartedAt: Date | null }, action: TicketAction): void {
  const allowedStatuses: Record<TicketAction, TicketStatus[]> = {
    ASSIGN: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
    RESPOND: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
    RESOLVE: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
    CLOSE: [TicketStatus.RESOLVED],
    REOPEN: [TicketStatus.RESOLVED, TicketStatus.CLOSED],
    PAUSE: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
    RESUME: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
  };

  if (!allowedStatuses[action].includes(ticket.status)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} ticket from ${ticket.status}`);
  }

  if (action === "PAUSE" && ticket.pauseStartedAt) {
    throw new PlatformError("CONFLICT", "Ticket is already paused");
  }

  if (action === "RESUME" && !ticket.pauseStartedAt) {
    throw new PlatformError("CONFLICT", "Ticket is not paused");
  }
}

function computeDefaultDueAt(openedAt: Date, resolutionMins: number | null | undefined): Date | null {
  if (!resolutionMins || resolutionMins <= 0) return null;
  return new Date(openedAt.getTime() + resolutionMins * 60_000);
}

export async function listTickets(ctx: PlatformRequestContext, input: unknown) {
  const parsed = ticketListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid ticket query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.TicketWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.priority ? { priority: q.priority } : {}),
    ...(q.queueId ? { queueId: q.queueId } : {}),
    ...(q.assignedTo ? { assignedTo: q.assignedTo } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.projectId ? { projectId: q.projectId } : {}),
    ...(q.q
      ? {
          OR: [
            { number: { contains: q.q, mode: "insensitive" } },
            { subject: { contains: q.q, mode: "insensitive" } },
            { description: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        project: { select: { id: true, code: true, name: true, status: true } },
        queue: { select: { id: true, name: true, status: true } },
        slaPolicy: { select: { id: true, name: true, status: true } },
      },
      orderBy: [{ openedAt: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createTicket(ctx: PlatformRequestContext, input: unknown) {
  const parsed = ticketCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid ticket payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await Promise.all([
    assertCustomer(ctx.companyId, payload.customerId),
    assertProject(ctx.companyId, payload.projectId),
    assertQueue(ctx.companyId, payload.queueId),
    assertSlaPolicy(ctx.companyId, payload.slaPolicyId),
  ]);

  const openedAt = new Date();
  const policy = payload.slaPolicyId
    ? await prisma.slaPolicy.findFirst({
        where: { id: payload.slaPolicyId, companyId: ctx.companyId },
        select: { resolutionMins: true },
      })
    : null;

  try {
    return await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          number: payload.number,
          status: TicketStatus.OPEN,
          priority: payload.priority,
          subject: payload.subject,
          description: payload.description,
          customerId: payload.customerId,
          projectId: payload.projectId,
          queueId: payload.queueId,
          slaPolicyId: payload.slaPolicyId,
          assignedTo: payload.assignedTo,
          openedAt,
          dueAt: payload.dueAt ?? computeDefaultDueAt(openedAt, policy?.resolutionMins),
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });

      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          eventType: "CREATED",
          payload: {
            number: ticket.number,
            priority: ticket.priority,
          } as Prisma.InputJsonValue,
          createdBy: ctx.userId,
        },
      });

      return tx.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        include: {
          customer: { select: { id: true, name: true } },
          project: { select: { id: true, code: true, name: true, status: true } },
          queue: { select: { id: true, name: true, status: true } },
          slaPolicy: { select: { id: true, name: true, status: true } },
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Ticket number already exists for this company");
    }
    throw error;
  }
}

export async function applyTicketAction(ctx: PlatformRequestContext, ticketId: string, input: unknown) {
  const parsed = ticketActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid ticket action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, companyId: ctx.companyId },
  });

  if (!ticket) {
    throw new PlatformError("NOT_FOUND", "Ticket not found");
  }

  assertActionAllowed(ticket, payload.action);

  if (payload.action === "ASSIGN" && !payload.assignedTo) {
    throw new PlatformError("VALIDATION_ERROR", "assignedTo is required for ASSIGN action");
  }

  const now = new Date();
  const pausedMinutesToAdd =
    payload.action === "RESUME" && ticket.pauseStartedAt
      ? Math.max(Math.floor((now.getTime() - ticket.pauseStartedAt.getTime()) / 60000), 0)
      : 0;

  const updateData: Prisma.TicketUpdateInput = {
    updatedBy: ctx.userId,
    assignedTo: payload.action === "ASSIGN" ? payload.assignedTo : ticket.assignedTo,
    firstResponseAt:
      payload.action === "RESPOND" && !ticket.firstResponseAt ? now : ticket.firstResponseAt,
    resolvedAt:
      payload.action === "RESOLVE"
        ? now
        : payload.action === "REOPEN"
          ? null
          : ticket.resolvedAt,
    closedAt:
      payload.action === "CLOSE"
        ? now
        : payload.action === "REOPEN"
          ? null
          : ticket.closedAt,
    pauseStartedAt:
      payload.action === "PAUSE"
        ? now
        : payload.action === "RESUME"
          ? null
          : ticket.pauseStartedAt,
    pausedMinutes:
      payload.action === "RESUME" ? ticket.pausedMinutes + pausedMinutesToAdd : ticket.pausedMinutes,
  };

  if (payload.action === "RESPOND") {
    updateData.status = TicketStatus.IN_PROGRESS;
  }
  if (payload.action === "RESOLVE") {
    updateData.status = TicketStatus.RESOLVED;
  }
  if (payload.action === "CLOSE") {
    updateData.status = TicketStatus.CLOSED;
  }
  if (payload.action === "REOPEN") {
    updateData.status = TicketStatus.IN_PROGRESS;
  }
  if (payload.action === "ASSIGN" && ticket.status === TicketStatus.OPEN) {
    updateData.status = TicketStatus.IN_PROGRESS;
  }

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticket.id },
      data: updateData,
    });

    await tx.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: payload.action,
        payload: {
          assignedTo: payload.assignedTo,
          note: payload.note,
        } as Prisma.InputJsonValue,
        createdBy: ctx.userId,
      },
    });
  });

  return prisma.ticket.findUniqueOrThrow({
    where: { id: ticket.id },
    include: {
      customer: { select: { id: true, name: true } },
      project: { select: { id: true, code: true, name: true, status: true } },
      queue: { select: { id: true, name: true, status: true } },
      slaPolicy: { select: { id: true, name: true, status: true } },
      events: {
        orderBy: [{ createdAt: "desc" }],
        take: 20,
      },
    },
  });
}
