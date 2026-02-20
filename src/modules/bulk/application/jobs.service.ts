import { BulkJobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  bulkJobActionSchema,
  bulkJobCreateSchema,
  bulkJobListQuerySchema,
} from "@/modules/bulk/domain/schemas";

type BulkAction = "RUN" | "CANCEL";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: BulkJobStatus, action: BulkAction): void {
  const allowed: Record<BulkAction, BulkJobStatus[]> = {
    RUN: [BulkJobStatus.DRAFT],
    CANCEL: [BulkJobStatus.DRAFT, BulkJobStatus.RUNNING],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} bulk job from ${current}`);
  }
}

export async function listBulkJobs(ctx: PlatformRequestContext, input: unknown) {
  const parsed = bulkJobListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid bulk job query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.BulkJobWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.q ? { name: { contains: q.q, mode: "insensitive" } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.bulkJob.findMany({
      where,
      include: {
        items: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.bulkJob.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createBulkJob(ctx: PlatformRequestContext, input: unknown) {
  const parsed = bulkJobCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid bulk job payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  return prisma.bulkJob.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      name: payload.name,
      status: BulkJobStatus.DRAFT,
      payload: payload.payload as Prisma.InputJsonValue | undefined,
      createdBy: ctx.userId,
      items: {
        create: payload.items.map((item) => ({
          itemKey: item.itemKey,
          status: item.status,
          message: item.message,
          payload: item.payload as Prisma.InputJsonValue | undefined,
        })),
      },
    },
    include: {
      items: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });
}

export async function applyBulkJobAction(
  ctx: PlatformRequestContext,
  jobId: string,
  input: unknown,
) {
  const parsed = bulkJobActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid bulk job action payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  const job = await prisma.bulkJob.findFirst({
    where: { id: jobId, companyId: ctx.companyId },
  });

  if (!job) {
    throw new PlatformError("NOT_FOUND", "Bulk job not found");
  }

  assertTransition(job.status, payload.action);

  if (payload.action === "CANCEL") {
    await prisma.$transaction(async (tx) => {
      await tx.bulkJob.update({
        where: { id: job.id },
        data: {
          status: BulkJobStatus.CANCELLED,
          completedAt: new Date(),
          error: payload.error ?? "Cancelled",
        },
      });

      await tx.bulkJobItem.updateMany({
        where: { jobId: job.id },
        data: {
          status: "CANCELLED",
          message: payload.error ?? "Cancelled",
        },
      });
    });

    return prisma.bulkJob.findUniqueOrThrow({
      where: { id: job.id },
      include: {
        items: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });
  }

  const now = new Date();
  const failed = Boolean(payload.error);

  await prisma.$transaction(async (tx) => {
    await tx.bulkJob.update({
      where: { id: job.id },
      data: {
        status: BulkJobStatus.RUNNING,
        startedAt: now,
      },
    });

    await tx.bulkJobItem.updateMany({
      where: {
        jobId: job.id,
        status: { in: ["PENDING", "DRAFT", "RUNNING"] },
      },
      data: {
        status: failed ? "FAILED" : "COMPLETED",
        message: payload.error ?? "Processed",
      },
    });

    await tx.bulkJob.update({
      where: { id: job.id },
      data: {
        status: failed ? BulkJobStatus.FAILED : BulkJobStatus.COMPLETED,
        completedAt: new Date(),
        result: payload.result as Prisma.InputJsonValue | undefined,
        error: payload.error,
      },
    });
  });

  return prisma.bulkJob.findUniqueOrThrow({
    where: { id: job.id },
    include: {
      items: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });
}
