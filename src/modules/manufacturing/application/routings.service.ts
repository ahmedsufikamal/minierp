import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { routingCreateSchema, routingListQuerySchema } from "@/modules/manufacturing/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertWorkstations(companyId: string, workstationIds: string[]): Promise<void> {
  const uniqueWorkstationIds = [...new Set(workstationIds.filter(Boolean))];
  if (uniqueWorkstationIds.length === 0) return;

  const count = await prisma.workstation.count({
    where: {
      companyId,
      id: { in: uniqueWorkstationIds },
    },
  });

  if (count !== uniqueWorkstationIds.length) {
    throw new PlatformError("VALIDATION_ERROR", "One or more workstation IDs are invalid for this company");
  }
}

export async function listRoutings(ctx: PlatformRequestContext, input: unknown) {
  const parsed = routingListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid routing query", parsed.error.flatten());
  }

  const q = parsed.data;

  const where: Prisma.RoutingWhereInput = {
    companyId: ctx.companyId,
    ...(typeof q.isActive === "boolean" ? { isActive: q.isActive } : {}),
    ...(q.q
      ? {
          OR: [
            { code: { contains: q.q, mode: "insensitive" } },
            { name: { contains: q.q, mode: "insensitive" } },
            { notes: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.routing.findMany({
      where,
      include: {
        operations: {
          include: {
            workstation: { select: { id: true, code: true, name: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.routing.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createRouting(ctx: PlatformRequestContext, input: unknown) {
  const parsed = routingCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid routing payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  await assertWorkstations(
    ctx.companyId,
    payload.operations.map((operation) => operation.workstationId ?? "").filter(Boolean),
  );

  try {
    return await prisma.routing.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        code: payload.code,
        name: payload.name,
        isActive: payload.isActive ?? true,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        operations: {
          create: payload.operations.map((operation, index) => ({
            lineNo: operation.lineNo ?? index + 1,
            operationName: operation.operationName,
            workstationId: operation.workstationId,
            durationMins: operation.durationMins,
            notes: operation.notes,
          })),
        },
      },
      include: {
        operations: {
          include: {
            workstation: { select: { id: true, code: true, name: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Routing code already exists for this company");
    }
    throw error;
  }
}
