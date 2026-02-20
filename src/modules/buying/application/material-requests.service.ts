import { MaterialRequestStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  materialRequestActionSchema,
  materialRequestCreateSchema,
  materialRequestListQuerySchema,
} from "@/modules/buying/domain/schemas";

type MaterialRequestAction = "SUBMIT" | "APPROVE" | "CANCEL" | "MARK_ORDERED";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: MaterialRequestStatus, action: MaterialRequestAction): void {
  const allowed: Record<MaterialRequestAction, MaterialRequestStatus[]> = {
    SUBMIT: [MaterialRequestStatus.DRAFT],
    APPROVE: [MaterialRequestStatus.SUBMITTED],
    CANCEL: [MaterialRequestStatus.DRAFT, MaterialRequestStatus.SUBMITTED, MaterialRequestStatus.APPROVED],
    MARK_ORDERED: [MaterialRequestStatus.APPROVED, MaterialRequestStatus.PARTIALLY_ORDERED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} material request from ${current}`);
  }
}

export async function listMaterialRequests(ctx: PlatformRequestContext, input: unknown) {
  const parsed = materialRequestListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid material request query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.MaterialRequestWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.q
      ? {
          OR: [
            { number: { contains: q.q, mode: "insensitive" } },
            { notes: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.materialRequest.findMany({
      where,
      include: {
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            preferredVendor: { select: { id: true, name: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
      orderBy: [{ requestDate: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.materialRequest.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createMaterialRequest(ctx: PlatformRequestContext, input: unknown) {
  const parsed = materialRequestCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid material request payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  for (const [index, line] of payload.lines.entries()) {
    if (line.productId) {
      const product = await prisma.product.findFirst({
        where: { id: line.productId, companyId: ctx.companyId },
        select: { id: true },
      });
      if (!product) {
        throw new PlatformError("VALIDATION_ERROR", `Invalid productId at line ${index + 1}`);
      }
    }

    if (line.preferredVendorId) {
      const vendor = await prisma.vendor.findFirst({
        where: { id: line.preferredVendorId, companyId: ctx.companyId },
        select: { id: true },
      });
      if (!vendor) {
        throw new PlatformError("VALIDATION_ERROR", `Invalid preferredVendorId at line ${index + 1}`);
      }
    }
  }

  try {
    return await prisma.materialRequest.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        status: MaterialRequestStatus.DRAFT,
        requestDate: payload.requestDate ?? new Date(),
        requiredBy: payload.requiredBy,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        lines: {
          create: payload.lines.map((line, index) => ({
            lineNo: index + 1,
            productId: line.productId,
            description: line.description,
            qtyRequested: line.qtyRequested,
            preferredVendorId: line.preferredVendorId,
          })),
        },
      },
      include: {
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            preferredVendor: { select: { id: true, name: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Material request number already exists for this company");
    }
    throw error;
  }
}

export async function applyMaterialRequestAction(
  ctx: PlatformRequestContext,
  materialRequestId: string,
  input: unknown,
) {
  const parsed = materialRequestActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid material request action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const request = await prisma.materialRequest.findFirst({
    where: { id: materialRequestId, companyId: ctx.companyId },
  });

  if (!request) {
    throw new PlatformError("NOT_FOUND", "Material request not found");
  }

  assertTransition(request.status, payload.action);

  return prisma.materialRequest.update({
    where: { id: request.id },
    data: {
      status:
        payload.action === "SUBMIT"
          ? MaterialRequestStatus.SUBMITTED
          : payload.action === "APPROVE"
            ? MaterialRequestStatus.APPROVED
            : payload.action === "CANCEL"
              ? MaterialRequestStatus.CANCELLED
              : MaterialRequestStatus.ORDERED,
      updatedBy: ctx.userId,
    },
    include: {
      lines: {
        include: {
          product: { select: { id: true, sku: true, name: true } },
          preferredVendor: { select: { id: true, name: true } },
        },
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });
}
