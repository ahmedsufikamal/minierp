import { Prisma, QualityInspectionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  qualityInspectionActionSchema,
  qualityInspectionCreateSchema,
  qualityInspectionListQuerySchema,
} from "@/modules/quality/domain/schemas";

type QualityInspectionAction = "SUBMIT" | "PASS" | "FAIL" | "CANCEL";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertQuantities(input: { qtyInspected: number; qtyAccepted: number; qtyRejected: number }): void {
  if (input.qtyAccepted + input.qtyRejected > input.qtyInspected) {
    throw new PlatformError("VALIDATION_ERROR", "Accepted + rejected quantity cannot exceed inspected quantity");
  }
}

async function assertItem(companyId: string, itemId: string | null | undefined): Promise<void> {
  if (!itemId) return;

  const item = await prisma.product.findFirst({
    where: { id: itemId, companyId },
    select: { id: true },
  });

  if (!item) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid itemId for this company");
  }
}

function assertTransition(current: QualityInspectionStatus, action: QualityInspectionAction): QualityInspectionStatus {
  const allowed: Record<QualityInspectionAction, QualityInspectionStatus[]> = {
    SUBMIT: [QualityInspectionStatus.DRAFT],
    PASS: [QualityInspectionStatus.DRAFT],
    FAIL: [QualityInspectionStatus.DRAFT],
    CANCEL: [QualityInspectionStatus.DRAFT],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} inspection from ${current}`);
  }

  switch (action) {
    case "SUBMIT":
      return QualityInspectionStatus.DRAFT;
    case "PASS":
      return QualityInspectionStatus.PASSED;
    case "FAIL":
      return QualityInspectionStatus.FAILED;
    case "CANCEL":
      return QualityInspectionStatus.CANCELLED;
  }
}

export async function listQualityInspections(ctx: PlatformRequestContext, input: unknown) {
  const parsed = qualityInspectionListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid quality inspection query", parsed.error.flatten());
  }

  const q = parsed.data;

  const where: Prisma.QualityInspectionWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.referenceType ? { referenceType: q.referenceType } : {}),
    ...(q.referenceId ? { referenceId: q.referenceId } : {}),
    ...(q.q
      ? {
          OR: [
            { number: { contains: q.q, mode: "insensitive" } },
            { notes: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.qualityInspection.findMany({
      where,
      include: {
        item: { select: { id: true, sku: true, name: true, uom: true } },
        capas: {
          orderBy: [{ createdAt: "desc" }],
        },
      },
      orderBy: [{ inspectedAt: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.qualityInspection.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createQualityInspection(ctx: PlatformRequestContext, input: unknown) {
  const parsed = qualityInspectionCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid quality inspection payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  assertQuantities(payload);
  await assertItem(ctx.companyId, payload.itemId);

  try {
    return await prisma.qualityInspection.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        status: QualityInspectionStatus.DRAFT,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        itemId: payload.itemId,
        qtyInspected: payload.qtyInspected,
        qtyAccepted: payload.qtyAccepted,
        qtyRejected: payload.qtyRejected,
        inspectedAt: payload.inspectedAt ?? new Date(),
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        item: { select: { id: true, sku: true, name: true, uom: true } },
        capas: {
          orderBy: [{ createdAt: "desc" }],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Inspection number already exists for this company");
    }
    throw error;
  }
}

export async function applyQualityInspectionAction(
  ctx: PlatformRequestContext,
  inspectionId: string,
  input: unknown,
) {
  const parsed = qualityInspectionActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid quality inspection action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const inspection = await prisma.qualityInspection.findFirst({
    where: { id: inspectionId, companyId: ctx.companyId },
  });

  if (!inspection) {
    throw new PlatformError("NOT_FOUND", "Quality inspection not found");
  }

  assertQuantities({
    qtyInspected: inspection.qtyInspected,
    qtyAccepted: inspection.qtyAccepted,
    qtyRejected: inspection.qtyRejected,
  });

  const nextStatus = assertTransition(inspection.status, payload.action);

  await prisma.qualityInspection.update({
    where: { id: inspection.id },
    data: {
      status: nextStatus,
      notes: payload.note ? [inspection.notes, payload.note].filter(Boolean).join("\n") : inspection.notes,
      updatedBy: ctx.userId,
    },
  });

  return prisma.qualityInspection.findUniqueOrThrow({
    where: { id: inspection.id },
    include: {
      item: { select: { id: true, sku: true, name: true, uom: true } },
      capas: {
        orderBy: [{ createdAt: "desc" }],
      },
    },
  });
}
