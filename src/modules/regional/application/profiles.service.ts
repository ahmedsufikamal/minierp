import { Prisma, RegionalProfileStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { regionalProfileActionSchema, regionalProfileCreateSchema, regionalProfileListQuerySchema } from "@/modules/regional/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export async function listRegionalProfiles(ctx: PlatformRequestContext, input: unknown) {
  const parsed = regionalProfileListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid regional profile query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.RegionalProfileWhereInput = {
    companyId: ctx.companyId,
    ...(q.countryCode ? { countryCode: q.countryCode } : {}),
    ...(q.status ? { status: q.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.regionalProfile.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.regionalProfile.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createRegionalProfile(ctx: PlatformRequestContext, input: unknown) {
  const parsed = regionalProfileCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid regional profile payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  try {
    return await prisma.regionalProfile.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        countryCode: payload.countryCode,
        profileKey: payload.profileKey,
        status: RegionalProfileStatus.ACTIVE,
        config: payload.config as Prisma.InputJsonValue,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Regional profile already exists for this company/country/profile key");
    }
    throw error;
  }
}

export async function applyRegionalProfileAction(ctx: PlatformRequestContext, profileId: string, input: unknown) {
  const parsed = regionalProfileActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid regional profile action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const profile = await prisma.regionalProfile.findFirst({
    where: { id: profileId, companyId: ctx.companyId },
  });

  if (!profile) {
    throw new PlatformError("NOT_FOUND", "Regional profile not found");
  }

  return prisma.regionalProfile.update({
    where: { id: profile.id },
    data: {
      status: payload.action === "ACTIVATE" ? RegionalProfileStatus.ACTIVE : RegionalProfileStatus.INACTIVE,
      notes: payload.note ? [profile.notes, payload.note].filter(Boolean).join("\n") : profile.notes,
      updatedBy: ctx.userId,
    },
  });
}
