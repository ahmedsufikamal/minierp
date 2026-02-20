import { Prisma, RequestForQuotationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { rfqActionSchema, rfqCreateSchema, rfqListQuerySchema } from "@/modules/buying/domain/schemas";

type RfqAction = "SEND" | "CLOSE" | "CANCEL";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: RequestForQuotationStatus, action: RfqAction): void {
  const allowed: Record<RfqAction, RequestForQuotationStatus[]> = {
    SEND: [RequestForQuotationStatus.DRAFT],
    CLOSE: [RequestForQuotationStatus.SENT],
    CANCEL: [RequestForQuotationStatus.DRAFT, RequestForQuotationStatus.SENT],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} RFQ from ${current}`);
  }
}

export async function listRfqs(ctx: PlatformRequestContext, input: unknown) {
  const parsed = rfqListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid RFQ query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.RequestForQuotationWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.materialRequestId ? { materialRequestId: q.materialRequestId } : {}),
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
    prisma.requestForQuotation.findMany({
      where,
      include: {
        materialRequest: { select: { id: true, number: true, status: true } },
        vendors: { include: { vendor: { select: { id: true, name: true } } } },
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            materialRequestLine: { select: { id: true, lineNo: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.requestForQuotation.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createRfq(ctx: PlatformRequestContext, input: unknown) {
  const parsed = rfqCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid RFQ payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  if (payload.materialRequestId) {
    const materialRequest = await prisma.materialRequest.findFirst({
      where: { id: payload.materialRequestId, companyId: ctx.companyId },
      select: { id: true },
    });

    if (!materialRequest) {
      throw new PlatformError("VALIDATION_ERROR", "Invalid materialRequestId for this company");
    }
  }

  for (const vendorId of payload.vendorIds) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId: ctx.companyId },
      select: { id: true },
    });

    if (!vendor) {
      throw new PlatformError("VALIDATION_ERROR", `Invalid vendorId '${vendorId}' for this company`);
    }
  }

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

    if (line.materialRequestLineId) {
      const requestLine = await prisma.materialRequestLine.findFirst({
        where: {
          id: line.materialRequestLineId,
          materialRequest: { companyId: ctx.companyId },
        },
        select: { id: true },
      });

      if (!requestLine) {
        throw new PlatformError("VALIDATION_ERROR", `Invalid materialRequestLineId at line ${index + 1}`);
      }
    }
  }

  try {
    return await prisma.requestForQuotation.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        status: RequestForQuotationStatus.DRAFT,
        materialRequestId: payload.materialRequestId,
        transactionDate: payload.transactionDate ?? new Date(),
        validUntil: payload.validUntil,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        vendors: {
          create: payload.vendorIds.map((vendorId) => ({
            vendorId,
          })),
        },
        lines: {
          create: payload.lines.map((line, index) => ({
            lineNo: index + 1,
            materialRequestLineId: line.materialRequestLineId,
            productId: line.productId,
            description: line.description,
            qty: line.qty,
            uom: line.uom,
          })),
        },
      },
      include: {
        materialRequest: { select: { id: true, number: true, status: true } },
        vendors: { include: { vendor: { select: { id: true, name: true } } } },
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            materialRequestLine: { select: { id: true, lineNo: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "RFQ number already exists for this company");
    }
    throw error;
  }
}

export async function applyRfqAction(ctx: PlatformRequestContext, rfqId: string, input: unknown) {
  const parsed = rfqActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid RFQ action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const rfq = await prisma.requestForQuotation.findFirst({
    where: { id: rfqId, companyId: ctx.companyId },
  });

  if (!rfq) {
    throw new PlatformError("NOT_FOUND", "RFQ not found");
  }

  assertTransition(rfq.status, payload.action);

  await prisma.$transaction(async (tx) => {
    await tx.requestForQuotation.update({
      where: { id: rfq.id },
      data: {
        status:
          payload.action === "SEND"
            ? RequestForQuotationStatus.SENT
            : payload.action === "CLOSE"
              ? RequestForQuotationStatus.CLOSED
              : RequestForQuotationStatus.CANCELLED,
        updatedBy: ctx.userId,
      },
    });

    if (payload.action === "SEND") {
      await tx.requestForQuotationVendor.updateMany({
        where: { requestForQuotationId: rfq.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });
    }
  });

  return prisma.requestForQuotation.findFirst({
    where: { id: rfqId, companyId: ctx.companyId },
    include: {
      materialRequest: { select: { id: true, number: true, status: true } },
      vendors: { include: { vendor: { select: { id: true, name: true } } } },
      lines: {
        include: {
          product: { select: { id: true, sku: true, name: true } },
          materialRequestLine: { select: { id: true, lineNo: true } },
        },
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });
}
