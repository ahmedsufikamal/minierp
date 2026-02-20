import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { communicationWindowCreateSchema, communicationWindowListQuerySchema } from "@/modules/communication/domain/schemas";

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

export async function listCommunicationWindows(ctx: PlatformRequestContext, input: unknown) {
  const parsed = communicationWindowListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid communication window query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.CommunicationWindowWhereInput = {
    companyId: ctx.companyId,
    ...(q.queueId ? { queueId: q.queueId } : {}),
    ...(q.channel ? { channel: q.channel } : {}),
    ...(typeof q.isActive === "boolean" ? { isActive: q.isActive } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.communicationWindow.findMany({
      where,
      include: {
        queue: { select: { id: true, name: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.communicationWindow.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createCommunicationWindow(ctx: PlatformRequestContext, input: unknown) {
  const parsed = communicationWindowCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid communication window payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  await assertQueue(ctx.companyId, payload.queueId);

  return prisma.communicationWindow.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      queueId: payload.queueId,
      name: payload.name,
      channel: payload.channel,
      timezone: payload.timezone,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      isActive: payload.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: {
      queue: { select: { id: true, name: true, status: true } },
    },
  });
}
