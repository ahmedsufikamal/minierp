import { MaintenanceScheduleStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  maintenanceScheduleActionSchema,
  maintenanceScheduleCreateSchema,
  maintenanceScheduleListQuerySchema,
} from "@/modules/maintenance/domain/schemas";

type MaintenanceAction = "START" | "COMPLETE" | "CANCEL";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertAsset(companyId: string, assetId: string): Promise<void> {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, companyId },
    select: { id: true },
  });
  if (!asset) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid assetId for this company");
  }
}

function nextStatus(current: MaintenanceScheduleStatus, action: MaintenanceAction): MaintenanceScheduleStatus {
  const allowed: Record<MaintenanceAction, MaintenanceScheduleStatus[]> = {
    START: [MaintenanceScheduleStatus.PLANNED],
    COMPLETE: [MaintenanceScheduleStatus.IN_PROGRESS],
    CANCEL: [MaintenanceScheduleStatus.PLANNED, MaintenanceScheduleStatus.IN_PROGRESS],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} maintenance schedule from ${current}`);
  }

  switch (action) {
    case "START":
      return MaintenanceScheduleStatus.IN_PROGRESS;
    case "COMPLETE":
      return MaintenanceScheduleStatus.COMPLETED;
    case "CANCEL":
      return MaintenanceScheduleStatus.CANCELLED;
  }
}

export async function listMaintenanceSchedules(ctx: PlatformRequestContext, input: unknown) {
  const parsed = maintenanceScheduleListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid maintenance schedule query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.MaintenanceScheduleWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.assetId ? { assetId: q.assetId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.maintenanceSchedule.findMany({
      where,
      include: {
        asset: { select: { id: true, assetNo: true, name: true, status: true } },
      },
      orderBy: [{ scheduledOn: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.maintenanceSchedule.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createMaintenanceSchedule(ctx: PlatformRequestContext, input: unknown) {
  const parsed = maintenanceScheduleCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid maintenance schedule payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  await assertAsset(ctx.companyId, payload.assetId);

  return prisma.maintenanceSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      assetId: payload.assetId,
      subject: payload.subject,
      status: MaintenanceScheduleStatus.PLANNED,
      scheduledOn: payload.scheduledOn,
      assignedTo: payload.assignedTo,
      notes: payload.notes,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: {
      asset: { select: { id: true, assetNo: true, name: true, status: true } },
    },
  });
}

export async function applyMaintenanceScheduleAction(
  ctx: PlatformRequestContext,
  scheduleId: string,
  input: unknown,
) {
  const parsed = maintenanceScheduleActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid maintenance schedule action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const schedule = await prisma.maintenanceSchedule.findFirst({
    where: { id: scheduleId, companyId: ctx.companyId },
  });

  if (!schedule) {
    throw new PlatformError("NOT_FOUND", "Maintenance schedule not found");
  }

  const status = nextStatus(schedule.status, payload.action);

  await prisma.$transaction(async (tx) => {
    await tx.maintenanceSchedule.update({
      where: { id: schedule.id },
      data: {
        status,
        completedOn: payload.action === "COMPLETE" ? new Date() : schedule.completedOn,
        notes: payload.note ? [schedule.notes, payload.note].filter(Boolean).join("\n") : schedule.notes,
        updatedBy: ctx.userId,
      },
    });

    if (payload.action === "START") {
      await tx.asset.update({
        where: { id: schedule.assetId },
        data: {
          status: "IN_MAINTENANCE",
          updatedBy: ctx.userId,
        },
      });
    }

    if (payload.action === "COMPLETE") {
      await tx.asset.update({
        where: { id: schedule.assetId },
        data: {
          status: "ACTIVE",
          updatedBy: ctx.userId,
        },
      });
    }
  });

  return prisma.maintenanceSchedule.findUniqueOrThrow({
    where: { id: schedule.id },
    include: {
      asset: { select: { id: true, assetNo: true, name: true, status: true } },
    },
  });
}
