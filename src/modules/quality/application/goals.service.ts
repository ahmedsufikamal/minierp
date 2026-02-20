import { Prisma, QualityGoalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  qualityGoalActionSchema,
  qualityGoalCreateSchema,
  qualityGoalListQuerySchema,
} from "@/modules/quality/domain/schemas";

type GoalAction =
  | "ACTIVATE"
  | "ACHIEVE"
  | "CLOSE"
  | "CANCEL"
  | "RESET"
  | "UPDATE_PROGRESS"
  | "LOG_FEEDBACK";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: QualityGoalStatus, action: GoalAction): QualityGoalStatus {
  if (action === "UPDATE_PROGRESS" || action === "LOG_FEEDBACK") {
    return current;
  }

  const allowed: Record<Exclude<GoalAction, "UPDATE_PROGRESS" | "LOG_FEEDBACK">, QualityGoalStatus[]> = {
    ACTIVATE: [QualityGoalStatus.DRAFT],
    ACHIEVE: [QualityGoalStatus.ACTIVE],
    CLOSE: [QualityGoalStatus.ACTIVE, QualityGoalStatus.ACHIEVED],
    CANCEL: [QualityGoalStatus.DRAFT, QualityGoalStatus.ACTIVE],
    RESET: [QualityGoalStatus.ACTIVE, QualityGoalStatus.ACHIEVED, QualityGoalStatus.CLOSED, QualityGoalStatus.CANCELLED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} quality goal from ${current}`);
  }

  switch (action) {
    case "ACTIVATE":
      return QualityGoalStatus.ACTIVE;
    case "ACHIEVE":
      return QualityGoalStatus.ACHIEVED;
    case "CLOSE":
      return QualityGoalStatus.CLOSED;
    case "CANCEL":
      return QualityGoalStatus.CANCELLED;
    case "RESET":
      return QualityGoalStatus.DRAFT;
    default:
      return current;
  }
}

export async function listQualityGoals(ctx: PlatformRequestContext, input: unknown) {
  const parsed = qualityGoalListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid quality goals query", parsed.error.flatten());
  }
  const q = parsed.data;

  const where: Prisma.QualityGoalWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.q
      ? {
          OR: [
            { key: { contains: q.q, mode: "insensitive" } },
            { name: { contains: q.q, mode: "insensitive" } },
            { metric: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.qualityGoal.findMany({
      where,
      include: {
        feedbacks: {
          orderBy: [{ createdAt: "desc" }],
          take: 5,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.qualityGoal.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createQualityGoal(ctx: PlatformRequestContext, input: unknown) {
  const parsed = qualityGoalCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid quality goal payload", parsed.error.flatten());
  }
  const payload = parsed.data;

  try {
    return await prisma.qualityGoal.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        key: payload.key,
        name: payload.name,
        description: payload.description ?? null,
        metric: payload.metric,
        targetValue: new Prisma.Decimal(payload.targetValue),
        currentValue: new Prisma.Decimal(payload.currentValue ?? 0),
        status: QualityGoalStatus.DRAFT,
        startDate: payload.startDate ?? null,
        dueDate: payload.dueDate ?? null,
        ownerRef: payload.ownerRef ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        feedbacks: {
          orderBy: [{ createdAt: "desc" }],
          take: 5,
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Quality goal key already exists for this company");
    }
    throw error;
  }
}

export async function applyQualityGoalAction(ctx: PlatformRequestContext, goalId: string, input: unknown) {
  const parsed = qualityGoalActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid quality goal action payload", parsed.error.flatten());
  }
  const payload = parsed.data;

  const goal = await prisma.qualityGoal.findFirst({
    where: { id: goalId, companyId: ctx.companyId },
  });
  if (!goal) {
    throw new PlatformError("NOT_FOUND", "Quality goal not found");
  }

  const nextStatus = assertTransition(goal.status, payload.action);
  const nextCurrentValue =
    payload.currentValue !== undefined ? new Prisma.Decimal(payload.currentValue) : goal.currentValue;

  const result = await prisma.$transaction(async (tx) => {
    if (payload.action === "LOG_FEEDBACK") {
      if (!payload.comments && payload.rating === undefined) {
        throw new PlatformError("VALIDATION_ERROR", "Feedback requires comments or rating");
      }
      await tx.qualityFeedback.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          goalId: goal.id,
          feedbackBy: ctx.userId,
          rating: payload.rating ?? null,
          comments: payload.comments ?? null,
        },
      });
    }

    const updated = await tx.qualityGoal.update({
      where: { id: goal.id },
      data: {
        status: nextStatus,
        currentValue: nextCurrentValue,
        updatedBy: ctx.userId,
      },
      include: {
        feedbacks: {
          orderBy: [{ createdAt: "desc" }],
          take: 5,
        },
      },
    });

    return updated;
  });

  return result;
}
