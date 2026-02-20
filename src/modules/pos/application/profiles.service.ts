import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { posProfileCreateSchema, posProfileListQuerySchema } from "@/modules/pos/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertWarehouse(
  companyId: string,
  warehouseId: string | null | undefined,
): Promise<void> {
  if (!warehouseId) return;

  const warehouse = await prisma.inventoryWarehouse.findFirst({
    where: { id: warehouseId, companyId },
    select: { id: true },
  });

  if (!warehouse) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid warehouseId for this company");
  }
}

export async function listPosProfiles(ctx: PlatformRequestContext, input: unknown) {
  const parsed = posProfileListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid POS profile query",
      parsed.error.flatten(),
    );
  }

  const q = parsed.data;
  const where: Prisma.PosProfileWhereInput = {
    companyId: ctx.companyId,
    ...(typeof q.isActive === "boolean" ? { isActive: q.isActive } : {}),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
            { warehouse: { name: { contains: q.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.posProfile.findMany({
      where,
      include: {
        warehouse: { select: { id: true, code: true, name: true, isActive: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.posProfile.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createPosProfile(ctx: PlatformRequestContext, input: unknown) {
  const parsed = posProfileCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid POS profile payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  await assertWarehouse(ctx.companyId, payload.warehouseId);

  try {
    return await prisma.posProfile.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: payload.name,
        warehouseId: payload.warehouseId,
        isActive: payload.isActive ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true, isActive: true } },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "POS profile name already exists for this company");
    }
    throw error;
  }
}
