import { PosShiftStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  posShiftActionSchema,
  posShiftCreateSchema,
  posShiftListQuerySchema,
} from "@/modules/pos/domain/schemas";

type ShiftAction = "OPEN" | "CLOSE";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertProfile(companyId: string, profileId: string): Promise<void> {
  const profile = await prisma.posProfile.findFirst({
    where: { id: profileId, companyId },
    select: { id: true, isActive: true },
  });

  if (!profile) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid profileId for this company");
  }

  if (!profile.isActive) {
    throw new PlatformError("CONFLICT", "Cannot create/open shift on an inactive POS profile");
  }
}

function assertTransition(current: PosShiftStatus, action: ShiftAction): PosShiftStatus {
  const allowed: Record<ShiftAction, PosShiftStatus[]> = {
    OPEN: [PosShiftStatus.CLOSED],
    CLOSE: [PosShiftStatus.OPEN],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} shift from ${current}`);
  }

  return action === "OPEN" ? PosShiftStatus.OPEN : PosShiftStatus.CLOSED;
}

export async function listPosShifts(ctx: PlatformRequestContext, input: unknown) {
  const parsed = posShiftListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid POS shift query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.PosShiftWhereInput = {
    companyId: ctx.companyId,
    ...(q.profileId ? { profileId: q.profileId } : {}),
    ...(q.status ? { status: q.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.posShift.findMany({
      where,
      include: {
        profile: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: [{ openedAt: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.posShift.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createPosShift(ctx: PlatformRequestContext, input: unknown) {
  const parsed = posShiftCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid POS shift payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  await assertProfile(ctx.companyId, payload.profileId);

  try {
    return await prisma.posShift.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        profileId: payload.profileId,
        status: PosShiftStatus.OPEN,
        openedAt: new Date(),
        openingCashMinor: payload.openingCashMinor,
        notes: payload.notes,
        openedBy: ctx.userId,
      },
      include: {
        profile: { select: { id: true, name: true, isActive: true } },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "POS shift number already exists for this company");
    }
    throw error;
  }
}

export async function applyPosShiftAction(
  ctx: PlatformRequestContext,
  shiftId: string,
  input: unknown,
) {
  const parsed = posShiftActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid POS shift action payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  const shift = await prisma.posShift.findFirst({
    where: { id: shiftId, companyId: ctx.companyId },
    include: {
      profile: { select: { id: true, name: true, isActive: true } },
    },
  });

  if (!shift) {
    throw new PlatformError("NOT_FOUND", "POS shift not found");
  }

  const nextStatus = assertTransition(shift.status, payload.action);

  if (payload.action === "CLOSE") {
    const openDraftSales = await prisma.posSale.count({
      where: {
        companyId: ctx.companyId,
        shiftId: shift.id,
        status: "DRAFT",
      },
    });

    if (openDraftSales > 0) {
      throw new PlatformError("CONFLICT", "Cannot close shift while draft sales exist");
    }
  }

  await prisma.posShift.update({
    where: { id: shift.id },
    data: {
      status: nextStatus,
      openedAt: payload.action === "OPEN" ? new Date() : shift.openedAt,
      openedBy: payload.action === "OPEN" ? ctx.userId : shift.openedBy,
      closedAt: payload.action === "CLOSE" ? new Date() : null,
      closedBy: payload.action === "CLOSE" ? ctx.userId : null,
      closingCashMinor:
        payload.action === "CLOSE"
          ? (payload.closingCashMinor ?? shift.closingCashMinor ?? shift.openingCashMinor)
          : null,
      notes: payload.note ? [shift.notes, payload.note].filter(Boolean).join("\n") : shift.notes,
    },
  });

  return prisma.posShift.findUniqueOrThrow({
    where: { id: shift.id },
    include: {
      profile: { select: { id: true, name: true, isActive: true } },
    },
  });
}
