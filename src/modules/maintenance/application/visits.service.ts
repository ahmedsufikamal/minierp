import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { maintenanceVisitCreateSchema, maintenanceVisitListQuerySchema } from "@/modules/maintenance/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertScheduleAndAsset(companyId: string, scheduleId: string, assetId: string): Promise<void> {
  const schedule = await prisma.maintenanceSchedule.findFirst({
    where: {
      id: scheduleId,
      companyId,
      assetId,
    },
    select: { id: true },
  });
  if (!schedule) {
    throw new PlatformError("VALIDATION_ERROR", "scheduleId and assetId must reference the same maintenance schedule");
  }
}

export async function listMaintenanceVisits(ctx: PlatformRequestContext, input: unknown) {
  const parsed = maintenanceVisitListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid maintenance visit query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.MaintenanceVisitWhereInput = {
    companyId: ctx.companyId,
    ...(q.scheduleId ? { scheduleId: q.scheduleId } : {}),
    ...(q.assetId ? { assetId: q.assetId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.maintenanceVisit.findMany({
      where,
      include: {
        schedule: { select: { id: true, subject: true, status: true } },
        asset: { select: { id: true, assetNo: true, name: true, status: true } },
      },
      orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.maintenanceVisit.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createMaintenanceVisit(ctx: PlatformRequestContext, input: unknown) {
  const parsed = maintenanceVisitCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid maintenance visit payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  await assertScheduleAndAsset(ctx.companyId, payload.scheduleId, payload.assetId);

  return prisma.maintenanceVisit.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      scheduleId: payload.scheduleId,
      assetId: payload.assetId,
      visitDate: payload.visitDate,
      technician: payload.technician,
      notes: payload.notes,
      createdBy: ctx.userId,
    },
    include: {
      schedule: { select: { id: true, subject: true, status: true } },
      asset: { select: { id: true, assetNo: true, name: true, status: true } },
    },
  });
}
