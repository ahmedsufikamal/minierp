import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { assetCategoryCreateSchema, assetCategoryListQuerySchema } from "@/modules/assets/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export async function listAssetCategories(ctx: PlatformRequestContext, input: unknown) {
  const parsed = assetCategoryListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid asset category query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.AssetCategoryWhereInput = {
    companyId: ctx.companyId,
    ...(typeof q.isActive === "boolean" ? { isActive: q.isActive } : {}),
    ...(q.q
      ? {
          OR: [{ name: { contains: q.q, mode: "insensitive" } }],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.assetCategory.findMany({
      where,
      include: {
        _count: {
          select: {
            assets: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.assetCategory.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createAssetCategory(ctx: PlatformRequestContext, input: unknown) {
  const parsed = assetCategoryCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid asset category payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  try {
    return await prisma.assetCategory.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: payload.name,
        depreciationMethod: payload.depreciationMethod,
        usefulLifeMonths: payload.usefulLifeMonths,
        isActive: payload.isActive ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        _count: {
          select: {
            assets: true,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Asset category name already exists for this company");
    }
    throw error;
  }
}
