import { ApiTokenStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  apiTokenActionSchema,
  apiTokenCreateSchema,
  apiTokenListQuerySchema,
} from "@/modules/integrations/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export async function listApiTokens(ctx: PlatformRequestContext, input: unknown) {
  const parsed = apiTokenListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid API token query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.IntegrationApiTokenWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.integrationApiToken.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.integrationApiToken.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createApiToken(ctx: PlatformRequestContext, input: unknown) {
  const parsed = apiTokenCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid API token payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  try {
    return await prisma.integrationApiToken.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: payload.name,
        tokenHash: payload.tokenHash,
        scopes: payload.scopes ? (payload.scopes as Prisma.InputJsonValue) : Prisma.JsonNull,
        status: ApiTokenStatus.ACTIVE,
        expiresAt: payload.expiresAt,
        createdBy: ctx.userId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "API token name already exists for this company");
    }
    throw error;
  }
}

export async function applyApiTokenAction(
  ctx: PlatformRequestContext,
  tokenId: string,
  input: unknown,
) {
  const parsed = apiTokenActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid API token action payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  const token = await prisma.integrationApiToken.findFirst({
    where: { id: tokenId, companyId: ctx.companyId },
  });

  if (!token) {
    throw new PlatformError("NOT_FOUND", "API token not found");
  }

  if (payload.action === "ACTIVATE" && token.expiresAt && token.expiresAt.getTime() < Date.now()) {
    throw new PlatformError("CONFLICT", "Cannot reactivate an expired API token");
  }

  return prisma.integrationApiToken.update({
    where: { id: token.id },
    data: {
      status: payload.action === "REVOKE" ? ApiTokenStatus.REVOKED : ApiTokenStatus.ACTIVE,
    },
  });
}
