import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { ediCodeListCreateSchema, ediCodeListQuerySchema } from "@/modules/edi/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export async function listEdiCodeLists(ctx: PlatformRequestContext, input: unknown) {
  const parsed = ediCodeListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid EDI code list query",
      parsed.error.flatten(),
    );
  }

  const q = parsed.data;
  const where: Prisma.EdiCodeListWhereInput = {
    companyId: ctx.companyId,
    ...(q.listType ? { listType: q.listType } : {}),
    ...(typeof q.isActive === "boolean" ? { isActive: q.isActive } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.ediCodeList.findMany({
      where,
      orderBy: [{ listType: "asc" }, { code: "asc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.ediCodeList.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createEdiCodeList(ctx: PlatformRequestContext, input: unknown) {
  const parsed = ediCodeListCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid EDI code list payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  try {
    return await prisma.ediCodeList.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        listType: payload.listType,
        code: payload.code,
        value: payload.value,
        isActive: payload.isActive ?? true,
        metadata: payload.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "EDI code already exists for this company/list type");
    }
    throw error;
  }
}
