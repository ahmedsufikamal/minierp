import { PortalConfigStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  portalConfigActionSchema,
  portalConfigCreateSchema,
  portalConfigListQuerySchema,
} from "@/modules/portal/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export async function listPortalConfigs(ctx: PlatformRequestContext, input: unknown) {
  const parsed = portalConfigListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid portal config query",
      parsed.error.flatten(),
    );
  }

  const q = parsed.data;
  const where: Prisma.PortalConfigWhereInput = {
    companyId: ctx.companyId,
    ...(q.partyType ? { partyType: q.partyType } : {}),
    ...(q.status ? { status: q.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.portalConfig.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.portalConfig.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createPortalConfig(ctx: PlatformRequestContext, input: unknown) {
  const parsed = portalConfigCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid portal config payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  try {
    return await prisma.portalConfig.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        partyType: payload.partyType,
        key: payload.key,
        status: PortalConfigStatus.ACTIVE,
        filters: payload.filters as Prisma.InputJsonValue | undefined,
        attributes: payload.attributes as Prisma.InputJsonValue | undefined,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError(
        "CONFLICT",
        "Portal config already exists for this company, party type, and key",
      );
    }
    throw error;
  }
}

export async function applyPortalConfigAction(
  ctx: PlatformRequestContext,
  configId: string,
  input: unknown,
) {
  const parsed = portalConfigActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid portal config action payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  const config = await prisma.portalConfig.findFirst({
    where: { id: configId, companyId: ctx.companyId },
  });

  if (!config) {
    throw new PlatformError("NOT_FOUND", "Portal config not found");
  }

  return prisma.portalConfig.update({
    where: { id: config.id },
    data: {
      status:
        payload.action === "ACTIVATE" ? PortalConfigStatus.ACTIVE : PortalConfigStatus.INACTIVE,
      notes: payload.note ? [config.notes, payload.note].filter(Boolean).join("\n") : config.notes,
      updatedBy: ctx.userId,
    },
  });
}
