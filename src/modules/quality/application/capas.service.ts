import { CapaStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { qualityCapaActionSchema, qualityCapaCreateSchema, qualityCapaListQuerySchema } from "@/modules/quality/domain/schemas";

type CapaAction = "START" | "CLOSE" | "REOPEN";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: CapaStatus, action: CapaAction): CapaStatus {
  const allowed: Record<CapaAction, CapaStatus[]> = {
    START: [CapaStatus.OPEN],
    CLOSE: [CapaStatus.OPEN, CapaStatus.IN_PROGRESS],
    REOPEN: [CapaStatus.CLOSED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} CAPA from ${current}`);
  }

  switch (action) {
    case "START":
      return CapaStatus.IN_PROGRESS;
    case "CLOSE":
      return CapaStatus.CLOSED;
    case "REOPEN":
      return CapaStatus.IN_PROGRESS;
  }
}

async function assertInspection(companyId: string, inspectionId: string): Promise<void> {
  const inspection = await prisma.qualityInspection.findFirst({
    where: {
      id: inspectionId,
      companyId,
    },
    select: { id: true },
  });

  if (!inspection) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid inspectionId for this company");
  }
}

export async function listQualityCapas(ctx: PlatformRequestContext, input: unknown) {
  const parsed = qualityCapaListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid quality CAPA query", parsed.error.flatten());
  }

  const q = parsed.data;

  const where: Prisma.QualityCapaWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.inspectionId ? { inspectionId: q.inspectionId } : {}),
    ...(q.q
      ? {
          OR: [
            { title: { contains: q.q, mode: "insensitive" } },
            { rootCause: { contains: q.q, mode: "insensitive" } },
            { correctiveAction: { contains: q.q, mode: "insensitive" } },
            { preventiveAction: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.qualityCapa.findMany({
      where,
      include: {
        inspection: {
          select: {
            id: true,
            number: true,
            status: true,
            referenceType: true,
            referenceId: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.qualityCapa.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createQualityCapa(ctx: PlatformRequestContext, input: unknown) {
  const parsed = qualityCapaCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid quality CAPA payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  await assertInspection(ctx.companyId, payload.inspectionId);

  return prisma.qualityCapa.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      inspectionId: payload.inspectionId,
      title: payload.title,
      rootCause: payload.rootCause,
      correctiveAction: payload.correctiveAction,
      preventiveAction: payload.preventiveAction,
      dueDate: payload.dueDate,
      status: CapaStatus.OPEN,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: {
      inspection: {
        select: {
          id: true,
          number: true,
          status: true,
          referenceType: true,
          referenceId: true,
        },
      },
    },
  });
}

export async function applyQualityCapaAction(ctx: PlatformRequestContext, capaId: string, input: unknown) {
  const parsed = qualityCapaActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid quality CAPA action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const capa = await prisma.qualityCapa.findFirst({
    where: {
      id: capaId,
      companyId: ctx.companyId,
    },
  });

  if (!capa) {
    throw new PlatformError("NOT_FOUND", "Quality CAPA not found");
  }

  const nextStatus = assertTransition(capa.status, payload.action);

  await prisma.qualityCapa.update({
    where: { id: capa.id },
    data: {
      status: nextStatus,
      closedAt: payload.action === "CLOSE" ? new Date() : payload.action === "REOPEN" ? null : capa.closedAt,
      correctiveAction: payload.note
        ? [capa.correctiveAction, payload.note].filter(Boolean).join("\n")
        : capa.correctiveAction,
      updatedBy: ctx.userId,
    },
  });

  return prisma.qualityCapa.findUniqueOrThrow({
    where: { id: capa.id },
    include: {
      inspection: {
        select: {
          id: true,
          number: true,
          status: true,
          referenceType: true,
          referenceId: true,
        },
      },
    },
  });
}
