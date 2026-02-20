import { Prisma, SlaPolicyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { slaPolicyCreateSchema, slaPolicyListQuerySchema } from "@/modules/support/domain/schemas";

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

export async function listSlaPolicies(ctx: PlatformRequestContext, input: unknown) {
  const parsed = slaPolicyListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid SLA policy query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.SlaPolicyWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.queueId ? { queueId: q.queueId } : {}),
    ...(q.q
      ? {
          OR: [{ name: { contains: q.q, mode: "insensitive" } }],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.slaPolicy.findMany({
      where,
      include: {
        queue: { select: { id: true, name: true, status: true } },
        _count: {
          select: {
            tickets: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.slaPolicy.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createSlaPolicy(ctx: PlatformRequestContext, input: unknown) {
  const parsed = slaPolicyCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid SLA policy payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  await assertQueue(ctx.companyId, payload.queueId);

  try {
    return await prisma.slaPolicy.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: payload.name,
        status: SlaPolicyStatus.ACTIVE,
        queueId: payload.queueId,
        firstResponseMins: payload.firstResponseMins,
        resolutionMins: payload.resolutionMins,
        pauseOnCustomerWait: payload.pauseOnCustomerWait ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        queue: { select: { id: true, name: true, status: true } },
        _count: {
          select: {
            tickets: true,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "SLA policy name already exists for this company");
    }
    throw error;
  }
}
