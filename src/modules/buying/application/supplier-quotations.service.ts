import { Prisma, RequestForQuotationStatus, SupplierQuotationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  supplierQuotationActionSchema,
  supplierQuotationCreateSchema,
  supplierQuotationListQuerySchema,
} from "@/modules/buying/domain/schemas";

type SupplierQuotationAction = "SUBMIT" | "ACCEPT" | "REJECT" | "EXPIRE";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: SupplierQuotationStatus, action: SupplierQuotationAction): void {
  const allowed: Record<SupplierQuotationAction, SupplierQuotationStatus[]> = {
    SUBMIT: [SupplierQuotationStatus.DRAFT],
    ACCEPT: [SupplierQuotationStatus.SUBMITTED],
    REJECT: [SupplierQuotationStatus.SUBMITTED],
    EXPIRE: [SupplierQuotationStatus.DRAFT, SupplierQuotationStatus.SUBMITTED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} supplier quotation from ${current}`);
  }
}

export async function listSupplierQuotations(ctx: PlatformRequestContext, input: unknown) {
  const parsed = supplierQuotationListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid supplier quotation query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.SupplierQuotationWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.vendorId ? { vendorId: q.vendorId } : {}),
    ...(q.requestForQuotationId ? { requestForQuotationId: q.requestForQuotationId } : {}),
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
    prisma.supplierQuotation.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        requestForQuotation: { select: { id: true, number: true, status: true } },
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            requestForQuotationLine: { select: { id: true, lineNo: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
      orderBy: [{ quoteDate: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.supplierQuotation.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createSupplierQuotation(ctx: PlatformRequestContext, input: unknown) {
  const parsed = supplierQuotationCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid supplier quotation payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const vendor = await prisma.vendor.findFirst({
    where: { id: payload.vendorId, companyId: ctx.companyId },
    select: { id: true },
  });

  if (!vendor) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid vendorId for this company");
  }

  if (payload.requestForQuotationId) {
    const rfq = await prisma.requestForQuotation.findFirst({
      where: { id: payload.requestForQuotationId, companyId: ctx.companyId },
      select: { id: true },
    });

    if (!rfq) {
      throw new PlatformError("VALIDATION_ERROR", "Invalid requestForQuotationId for this company");
    }

    const rfqVendor = await prisma.requestForQuotationVendor.findFirst({
      where: {
        requestForQuotationId: payload.requestForQuotationId,
        vendorId: payload.vendorId,
      },
      select: { id: true },
    });

    if (!rfqVendor) {
      throw new PlatformError("VALIDATION_ERROR", "Vendor is not attached to the referenced RFQ");
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

    if (line.requestForQuotationLineId) {
      const rfqLine = await prisma.requestForQuotationLine.findFirst({
        where: {
          id: line.requestForQuotationLineId,
          requestForQuotation: { companyId: ctx.companyId },
        },
        select: { id: true },
      });

      if (!rfqLine) {
        throw new PlatformError("VALIDATION_ERROR", `Invalid requestForQuotationLineId at line ${index + 1}`);
      }
    }
  }

  try {
    return await prisma.supplierQuotation.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        status: SupplierQuotationStatus.DRAFT,
        vendorId: payload.vendorId,
        requestForQuotationId: payload.requestForQuotationId,
        quoteDate: payload.quoteDate ?? new Date(),
        validUntil: payload.validUntil,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        lines: {
          create: payload.lines.map((line, index) => ({
            lineNo: index + 1,
            requestForQuotationLineId: line.requestForQuotationLineId,
            productId: line.productId,
            description: line.description,
            qty: line.qty,
            unitPriceCents: line.unitPriceCents,
            deliveryDays: line.deliveryDays,
          })),
        },
      },
      include: {
        vendor: { select: { id: true, name: true } },
        requestForQuotation: { select: { id: true, number: true, status: true } },
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            requestForQuotationLine: { select: { id: true, lineNo: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Supplier quotation number already exists for this company");
    }
    throw error;
  }
}

export async function applySupplierQuotationAction(
  ctx: PlatformRequestContext,
  supplierQuotationId: string,
  input: unknown,
) {
  const parsed = supplierQuotationActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid supplier quotation action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const quotation = await prisma.supplierQuotation.findFirst({
    where: { id: supplierQuotationId, companyId: ctx.companyId },
    select: { id: true, status: true, requestForQuotationId: true },
  });

  if (!quotation) {
    throw new PlatformError("NOT_FOUND", "Supplier quotation not found");
  }

  assertTransition(quotation.status, payload.action);

  await prisma.$transaction(async (tx) => {
    await tx.supplierQuotation.update({
      where: { id: quotation.id },
      data: {
        status:
          payload.action === "SUBMIT"
            ? SupplierQuotationStatus.SUBMITTED
            : payload.action === "ACCEPT"
              ? SupplierQuotationStatus.ACCEPTED
              : payload.action === "REJECT"
                ? SupplierQuotationStatus.REJECTED
                : SupplierQuotationStatus.EXPIRED,
        updatedBy: ctx.userId,
      },
    });

    if (payload.action === "ACCEPT" && quotation.requestForQuotationId) {
      await tx.requestForQuotation.update({
        where: { id: quotation.requestForQuotationId },
        data: {
          status: RequestForQuotationStatus.CLOSED,
          updatedBy: ctx.userId,
        },
      });
    }
  });

  return prisma.supplierQuotation.findFirst({
    where: { id: supplierQuotationId, companyId: ctx.companyId },
    include: {
      vendor: { select: { id: true, name: true } },
      requestForQuotation: { select: { id: true, number: true, status: true } },
      lines: {
        include: {
          product: { select: { id: true, sku: true, name: true } },
          requestForQuotationLine: { select: { id: true, lineNo: true } },
        },
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });
}
