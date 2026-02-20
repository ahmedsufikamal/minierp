import { JobCardStatus, Prisma, WorkOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { jobCardActionSchema, jobCardCreateSchema, jobCardListQuerySchema } from "@/modules/manufacturing/domain/schemas";

type JobCardAction = "START" | "COMPLETE" | "CANCEL";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertWorkOrder(companyId: string, workOrderId: string): Promise<void> {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId },
    select: { id: true, status: true },
  });

  if (!workOrder) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid workOrderId for this company");
  }

  if (workOrder.status === WorkOrderStatus.COMPLETED || workOrder.status === WorkOrderStatus.CANCELLED) {
    throw new PlatformError("CONFLICT", "Cannot create job card for completed/cancelled work order");
  }
}

async function assertWorkstationCapacity(
  companyId: string,
  workstationId: string,
  additionalMinutes: number,
  currentJobCardId?: string,
): Promise<void> {
  const workstation = await prisma.workstation.findFirst({
    where: { id: workstationId, companyId, isActive: true },
    select: { id: true, capacityMinsPerDay: true },
  });

  if (!workstation) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid workstationId for this company");
  }

  const activeLoad = await prisma.jobCard.aggregate({
    where: {
      companyId,
      workstationId,
      status: JobCardStatus.IN_PROGRESS,
      ...(currentJobCardId ? { id: { not: currentJobCardId } } : {}),
    },
    _sum: {
      plannedMins: true,
    },
  });

  const reserved = activeLoad._sum.plannedMins ?? 0;
  if (reserved + additionalMinutes > workstation.capacityMinsPerDay) {
    throw new PlatformError(
      "CONFLICT",
      `Workstation capacity exceeded. Requested ${reserved + additionalMinutes}, limit ${workstation.capacityMinsPerDay}`,
    );
  }
}

function assertTransition(current: JobCardStatus, action: JobCardAction): JobCardStatus {
  const allowed: Record<JobCardAction, JobCardStatus[]> = {
    START: [JobCardStatus.OPEN],
    COMPLETE: [JobCardStatus.IN_PROGRESS],
    CANCEL: [JobCardStatus.OPEN, JobCardStatus.IN_PROGRESS],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} job card from ${current}`);
  }

  return action === "START" ? JobCardStatus.IN_PROGRESS : action === "COMPLETE" ? JobCardStatus.COMPLETED : JobCardStatus.CANCELLED;
}

async function ensureNoFailedInspection(companyId: string, jobCardId: string): Promise<void> {
  const failed = await prisma.qualityInspection.count({
    where: {
      companyId,
      referenceType: "JOB_CARD",
      referenceId: jobCardId,
      status: "FAILED",
    },
  });

  if (failed > 0) {
    throw new PlatformError("CONFLICT", "Cannot complete job card while failed inspections exist");
  }
}

export async function listJobCards(ctx: PlatformRequestContext, input: unknown) {
  const parsed = jobCardListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid job card query", parsed.error.flatten());
  }

  const q = parsed.data;

  const where: Prisma.JobCardWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.workOrderId ? { workOrderId: q.workOrderId } : {}),
    ...(q.workstationId ? { workstationId: q.workstationId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.jobCard.findMany({
      where,
      include: {
        workOrder: { select: { id: true, number: true, status: true } },
        workstation: { select: { id: true, code: true, name: true, capacityMinsPerDay: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.jobCard.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createJobCard(ctx: PlatformRequestContext, input: unknown) {
  const parsed = jobCardCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid job card payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await assertWorkOrder(ctx.companyId, payload.workOrderId);
  if (payload.workstationId) {
    await assertWorkstationCapacity(ctx.companyId, payload.workstationId, payload.plannedMins);
  }

  return prisma.jobCard.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      workOrderId: payload.workOrderId,
      operationNo: payload.operationNo,
      operationName: payload.operationName,
      workstationId: payload.workstationId,
      plannedMins: payload.plannedMins,
      notes: payload.notes,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: {
      workOrder: { select: { id: true, number: true, status: true } },
      workstation: { select: { id: true, code: true, name: true, capacityMinsPerDay: true } },
    },
  });
}

export async function applyJobCardAction(ctx: PlatformRequestContext, jobCardId: string, input: unknown) {
  const parsed = jobCardActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid job card action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const card = await prisma.jobCard.findFirst({
    where: { id: jobCardId, companyId: ctx.companyId },
    include: {
      workOrder: {
        select: {
          id: true,
          status: true,
          qtyPlanned: true,
        },
      },
    },
  });

  if (!card) {
    throw new PlatformError("NOT_FOUND", "Job card not found");
  }

  const nextStatus = assertTransition(card.status, payload.action);

  if (payload.action === "START" && card.workstationId) {
    await assertWorkstationCapacity(ctx.companyId, card.workstationId, card.plannedMins, card.id);
  }

  if (payload.action === "COMPLETE") {
    await ensureNoFailedInspection(ctx.companyId, card.id);
  }

  await prisma.$transaction(async (tx) => {
    await tx.jobCard.update({
      where: { id: card.id },
      data: {
        status: nextStatus,
        startedAt: payload.action === "START" ? new Date() : card.startedAt,
        completedAt: payload.action === "COMPLETE" ? new Date() : card.completedAt,
        actualMins: payload.action === "COMPLETE" ? payload.actualMins ?? card.actualMins ?? card.plannedMins : card.actualMins,
        notes: payload.note ? [card.notes, payload.note].filter(Boolean).join("\n") : card.notes,
        updatedBy: ctx.userId,
      },
    });

    if (payload.action === "START" && card.workOrder.status === WorkOrderStatus.RELEASED) {
      await tx.workOrder.update({
        where: { id: card.workOrder.id },
        data: {
          status: WorkOrderStatus.IN_PROGRESS,
          startedAt: new Date(),
          updatedBy: ctx.userId,
        },
      });
    }

    if (payload.action === "COMPLETE") {
      const pending = await tx.jobCard.count({
        where: {
          companyId: ctx.companyId,
          workOrderId: card.workOrder.id,
          status: { in: [JobCardStatus.OPEN, JobCardStatus.IN_PROGRESS] },
        },
      });

      if (pending === 0) {
        await tx.workOrder.update({
          where: { id: card.workOrder.id },
          data: {
            status: WorkOrderStatus.COMPLETED,
            qtyCompleted: card.workOrder.qtyPlanned,
            completedAt: new Date(),
            updatedBy: ctx.userId,
          },
        });
      }
    }
  });

  return prisma.jobCard.findUniqueOrThrow({
    where: { id: card.id },
    include: {
      workOrder: { select: { id: true, number: true, status: true } },
      workstation: { select: { id: true, code: true, name: true, capacityMinsPerDay: true } },
    },
  });
}
