import { AssetStatus, DepreciationEntryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { assetActionSchema, assetCreateSchema, assetListQuerySchema } from "@/modules/assets/domain/schemas";

type AssetAction = "ACTIVATE" | "START_MAINTENANCE" | "POST_DEPRECIATION" | "DISPOSE";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertCategory(companyId: string, categoryId: string | null | undefined): Promise<void> {
  if (!categoryId) return;
  const category = await prisma.assetCategory.findFirst({
    where: { id: categoryId, companyId },
    select: { id: true },
  });
  if (!category) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid categoryId for this company");
  }
}

function assertActionAllowed(status: AssetStatus, action: AssetAction): void {
  const allowed: Record<AssetAction, AssetStatus[]> = {
    ACTIVATE: [AssetStatus.DRAFT],
    START_MAINTENANCE: [AssetStatus.ACTIVE],
    POST_DEPRECIATION: [AssetStatus.ACTIVE, AssetStatus.IN_MAINTENANCE],
    DISPOSE: [AssetStatus.ACTIVE, AssetStatus.IN_MAINTENANCE],
  };

  if (!allowed[action].includes(status)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} asset from ${status}`);
  }
}

export async function listAssets(ctx: PlatformRequestContext, input: unknown) {
  const parsed = assetListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid asset query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.AssetWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.q
      ? {
          OR: [
            { assetNo: { contains: q.q, mode: "insensitive" } },
            { name: { contains: q.q, mode: "insensitive" } },
            { notes: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, depreciationMethod: true, usefulLifeMonths: true } },
        depreciationEntries: {
          orderBy: [{ postingDate: "desc" }],
          take: 12,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.asset.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createAsset(ctx: PlatformRequestContext, input: unknown) {
  const parsed = assetCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid asset payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await assertCategory(ctx.companyId, payload.categoryId);

  if (payload.salvageMinor > payload.costMinor) {
    throw new PlatformError("VALIDATION_ERROR", "salvageMinor cannot exceed costMinor");
  }

  try {
    return await prisma.asset.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        assetNo: payload.assetNo,
        name: payload.name,
        categoryId: payload.categoryId,
        acquiredOn: payload.acquiredOn,
        inServiceOn: payload.inServiceOn,
        costMinor: payload.costMinor,
        salvageMinor: payload.salvageMinor,
        usefulLifeMonths: payload.usefulLifeMonths,
        depreciationMethod: payload.depreciationMethod,
        currentBookValueMinor: payload.costMinor,
        status: AssetStatus.DRAFT,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        category: { select: { id: true, name: true, depreciationMethod: true, usefulLifeMonths: true } },
        depreciationEntries: {
          orderBy: [{ postingDate: "desc" }],
          take: 12,
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Asset number already exists for this company");
    }
    throw error;
  }
}

export async function applyAssetAction(ctx: PlatformRequestContext, assetId: string, input: unknown) {
  const parsed = assetActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid asset action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, companyId: ctx.companyId },
  });

  if (!asset) {
    throw new PlatformError("NOT_FOUND", "Asset not found");
  }

  assertActionAllowed(asset.status, payload.action);

  await prisma.$transaction(async (tx) => {
    if (payload.action === "POST_DEPRECIATION") {
      if (!payload.amountMinor || payload.amountMinor <= 0) {
        throw new PlatformError("VALIDATION_ERROR", "amountMinor is required for POST_DEPRECIATION action");
      }

      const nextBookValue = Math.max(asset.currentBookValueMinor - payload.amountMinor, asset.salvageMinor);
      if (nextBookValue === asset.currentBookValueMinor) {
        throw new PlatformError("CONFLICT", "Asset is already at salvage value; no further depreciation allowed");
      }

      const actualDepreciation = asset.currentBookValueMinor - nextBookValue;

      await tx.assetDepreciationEntry.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          assetId: asset.id,
          postingDate: payload.postingDate ?? new Date(),
          amountMinor: actualDepreciation,
          status: DepreciationEntryStatus.POSTED,
          postedAt: new Date(),
          postedBy: ctx.userId,
        },
      });

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          currentBookValueMinor: nextBookValue,
          notes: payload.note ? [asset.notes, payload.note].filter(Boolean).join("\n") : asset.notes,
          updatedBy: ctx.userId,
        },
      });
    } else {
      await tx.asset.update({
        where: { id: asset.id },
        data: {
          status:
            payload.action === "ACTIVATE"
              ? AssetStatus.ACTIVE
              : payload.action === "START_MAINTENANCE"
                ? AssetStatus.IN_MAINTENANCE
                : AssetStatus.DISPOSED,
          disposedOn: payload.action === "DISPOSE" ? payload.postingDate ?? new Date() : asset.disposedOn,
          notes: payload.note ? [asset.notes, payload.note].filter(Boolean).join("\n") : asset.notes,
          updatedBy: ctx.userId,
        },
      });
    }
  });

  return prisma.asset.findUniqueOrThrow({
    where: { id: asset.id },
    include: {
      category: { select: { id: true, name: true, depreciationMethod: true, usefulLifeMonths: true } },
      depreciationEntries: {
        orderBy: [{ postingDate: "desc" }],
        take: 12,
      },
    },
  });
}
