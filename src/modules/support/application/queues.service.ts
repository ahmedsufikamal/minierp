import { Prisma, QueueStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { supportQueueCreateSchema, supportQueueListQuerySchema } from "@/modules/support/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export async function listSupportQueues(ctx: PlatformRequestContext, input: unknown) {
  const parsed = supportQueueListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid support queue query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.SupportQueueWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
            { description: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.supportQueue.findMany({
      where,
      include: {
        _count: {
          select: {
            tickets: true,
            communications: true,
            calls: true,
            slaPolicies: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.supportQueue.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createSupportQueue(ctx: PlatformRequestContext, input: unknown) {
  const parsed = supportQueueCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid support queue payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  try {
    return await prisma.supportQueue.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: payload.name,
        status: QueueStatus.ACTIVE,
        description: payload.description,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        _count: {
          select: {
            tickets: true,
            communications: true,
            calls: true,
            slaPolicies: true,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Support queue name already exists for this company");
    }
    throw error;
  }
}
