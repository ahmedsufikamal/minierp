import { Prisma, UtilityTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  utilityTaskActionSchema,
  utilityTaskCreateSchema,
  utilityTaskListQuerySchema,
} from "@/modules/utilities/domain/schemas";

type UtilityAction = "START" | "COMPLETE" | "FAIL" | "CANCEL";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: UtilityTaskStatus, action: UtilityAction): void {
  const allowed: Record<UtilityAction, UtilityTaskStatus[]> = {
    START: [UtilityTaskStatus.PENDING],
    COMPLETE: [UtilityTaskStatus.RUNNING],
    FAIL: [UtilityTaskStatus.RUNNING],
    CANCEL: [UtilityTaskStatus.PENDING, UtilityTaskStatus.RUNNING],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError(
      "CONFLICT",
      `Cannot ${action.toLowerCase()} utility task from ${current}`,
    );
  }
}

export async function listUtilityTasks(ctx: PlatformRequestContext, input: unknown) {
  const parsed = utilityTaskListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid utility task query",
      parsed.error.flatten(),
    );
  }

  const q = parsed.data;
  const where: Prisma.UtilityTaskWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.q ? { name: { contains: q.q, mode: "insensitive" } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.utilityTask.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.utilityTask.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createUtilityTask(ctx: PlatformRequestContext, input: unknown) {
  const parsed = utilityTaskCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid utility task payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  return prisma.utilityTask.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      name: payload.name,
      status: UtilityTaskStatus.PENDING,
      input: payload.input as Prisma.InputJsonValue | undefined,
      createdBy: ctx.userId,
    },
  });
}

export async function applyUtilityTaskAction(
  ctx: PlatformRequestContext,
  taskId: string,
  input: unknown,
) {
  const parsed = utilityTaskActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid utility task action payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  const task = await prisma.utilityTask.findFirst({
    where: { id: taskId, companyId: ctx.companyId },
  });

  if (!task) {
    throw new PlatformError("NOT_FOUND", "Utility task not found");
  }

  assertTransition(task.status, payload.action);

  const now = new Date();

  return prisma.utilityTask.update({
    where: { id: task.id },
    data: {
      status:
        payload.action === "START"
          ? UtilityTaskStatus.RUNNING
          : payload.action === "COMPLETE"
            ? UtilityTaskStatus.COMPLETED
            : payload.action === "FAIL"
              ? UtilityTaskStatus.FAILED
              : UtilityTaskStatus.CANCELLED,
      startedAt: payload.action === "START" ? now : task.startedAt,
      completedAt:
        payload.action === "COMPLETE" || payload.action === "FAIL" || payload.action === "CANCEL"
          ? now
          : null,
      output: payload.output as Prisma.InputJsonValue | undefined,
      error: payload.error,
    },
  });
}
