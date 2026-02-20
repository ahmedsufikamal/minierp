import { BomStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { bomActionSchema, bomCreateSchema, bomListQuerySchema } from "@/modules/manufacturing/domain/schemas";

type BomAction = "ACTIVATE" | "INACTIVATE" | "SET_DEFAULT";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertProductsExist(companyId: string, itemIds: string[]): Promise<void> {
  const uniqueItemIds = [...new Set(itemIds)];
  if (uniqueItemIds.length === 0) {
    throw new PlatformError("VALIDATION_ERROR", "BOM requires at least one item");
  }

  const count = await prisma.product.count({
    where: {
      companyId,
      id: { in: uniqueItemIds },
    },
  });

  if (count !== uniqueItemIds.length) {
    throw new PlatformError("VALIDATION_ERROR", "One or more BOM items do not belong to this company");
  }
}

function assertTransition(current: BomStatus, action: BomAction): void {
  const allowed: Record<BomAction, BomStatus[]> = {
    ACTIVATE: [BomStatus.DRAFT, BomStatus.INACTIVE],
    INACTIVATE: [BomStatus.ACTIVE],
    SET_DEFAULT: [BomStatus.ACTIVE],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} BOM from ${current}`);
  }
}

export async function listBoms(ctx: PlatformRequestContext, input: unknown) {
  const parsed = bomListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid BOM query", parsed.error.flatten());
  }

  const q = parsed.data;

  const where: Prisma.BomWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.itemId ? { itemId: q.itemId } : {}),
    ...(q.q
      ? {
          OR: [
            { code: { contains: q.q, mode: "insensitive" } },
            { notes: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.bom.findMany({
      where,
      include: {
        item: { select: { id: true, sku: true, name: true, uom: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true, uom: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.bom.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createBom(ctx: PlatformRequestContext, input: unknown) {
  const parsed = bomCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid BOM payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await assertProductsExist(ctx.companyId, [payload.itemId, ...payload.lines.map((line) => line.itemId)]);

  try {
    return await prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.bom.updateMany({
          where: {
            companyId: ctx.companyId,
            itemId: payload.itemId,
          },
          data: { isDefault: false },
        });
      }

      return tx.bom.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          code: payload.code,
          status: BomStatus.DRAFT,
          itemId: payload.itemId,
          quantity: payload.quantity,
          isDefault: payload.isDefault ?? false,
          notes: payload.notes,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
          lines: {
            create: payload.lines.map((line, index) => ({
              lineNo: index + 1,
              itemId: line.itemId,
              quantity: line.quantity,
              scrapPct: line.scrapPct,
            })),
          },
        },
        include: {
          item: { select: { id: true, sku: true, name: true, uom: true } },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true, uom: true } },
            },
            orderBy: [{ lineNo: "asc" }],
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "BOM code already exists for this company");
    }
    throw error;
  }
}

export async function applyBomAction(ctx: PlatformRequestContext, bomId: string, input: unknown) {
  const parsed = bomActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid BOM action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const bom = await prisma.bom.findFirst({
    where: {
      id: bomId,
      companyId: ctx.companyId,
    },
    include: {
      lines: true,
    },
  });

  if (!bom) {
    throw new PlatformError("NOT_FOUND", "BOM not found");
  }

  assertTransition(bom.status, payload.action);

  return prisma.$transaction(async (tx) => {
    if (payload.action === "SET_DEFAULT") {
      await tx.bom.updateMany({
        where: {
          companyId: ctx.companyId,
          itemId: bom.itemId,
        },
        data: { isDefault: false },
      });

      await tx.bom.update({
        where: { id: bom.id },
        data: {
          isDefault: true,
          updatedBy: ctx.userId,
        },
      });
    } else {
      await tx.bom.update({
        where: { id: bom.id },
        data: {
          status: payload.action === "ACTIVATE" ? BomStatus.ACTIVE : BomStatus.INACTIVE,
          updatedBy: ctx.userId,
        },
      });
    }

    return tx.bom.findUniqueOrThrow({
      where: { id: bom.id },
      include: {
        item: { select: { id: true, sku: true, name: true, uom: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true, uom: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
    });
  });
}
