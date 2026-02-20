import { EdiTransportStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  ediTransportActionSchema,
  ediTransportCreateSchema,
  ediTransportQuerySchema,
} from "@/modules/edi/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export async function listEdiTransports(ctx: PlatformRequestContext, input: unknown) {
  const parsed = ediTransportQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid EDI transport query",
      parsed.error.flatten(),
    );
  }

  const q = parsed.data;
  const where: Prisma.EdiTransportWhereInput = {
    companyId: ctx.companyId,
    ...(q.type ? { type: q.type } : {}),
    ...(q.status ? { status: q.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.ediTransport.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.ediTransport.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createEdiTransport(ctx: PlatformRequestContext, input: unknown) {
  const parsed = ediTransportCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid EDI transport payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  try {
    return await prisma.ediTransport.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: payload.name,
        type: payload.type,
        status: EdiTransportStatus.ACTIVE,
        config: payload.config as Prisma.InputJsonValue,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "EDI transport name already exists for this company");
    }
    throw error;
  }
}

export async function applyEdiTransportAction(
  ctx: PlatformRequestContext,
  transportId: string,
  input: unknown,
) {
  const parsed = ediTransportActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid EDI transport action payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  const transport = await prisma.ediTransport.findFirst({
    where: { id: transportId, companyId: ctx.companyId },
  });

  if (!transport) {
    throw new PlatformError("NOT_FOUND", "EDI transport not found");
  }

  return prisma.ediTransport.update({
    where: { id: transport.id },
    data: {
      status:
        payload.action === "ACTIVATE" ? EdiTransportStatus.ACTIVE : EdiTransportStatus.INACTIVE,
      updatedBy: ctx.userId,
    },
  });
}
