import { Prisma, SubcontractingOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  subcontractingOrderActionSchema,
  subcontractingOrderCreateSchema,
  subcontractingOrderListQuerySchema,
} from "@/modules/subcontracting/domain/schemas";

type SubcontractingOrderAction = "SUBMIT" | "START" | "COMPLETE" | "CANCEL";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertVendor(companyId: string, vendorId: string): Promise<void> {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, companyId },
    select: { id: true },
  });

  if (!vendor) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid vendorId for this company");
  }
}

async function assertProducts(companyId: string, itemIds: string[]): Promise<void> {
  const uniqueItemIds = [...new Set(itemIds)];
  const count = await prisma.product.count({
    where: {
      companyId,
      id: { in: uniqueItemIds },
    },
  });
  if (count !== uniqueItemIds.length) {
    throw new PlatformError("VALIDATION_ERROR", "One or more subcontracting items are invalid");
  }
}

async function assertWarehouse(companyId: string, warehouseId: string | null | undefined): Promise<void> {
  if (!warehouseId) return;
  const warehouse = await prisma.inventoryWarehouse.findFirst({
    where: { id: warehouseId, companyId },
    select: { id: true },
  });
  if (!warehouse) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid issueWarehouseId for this company");
  }
}

function assertTransition(current: SubcontractingOrderStatus, action: SubcontractingOrderAction): SubcontractingOrderStatus {
  const allowed: Record<SubcontractingOrderAction, SubcontractingOrderStatus[]> = {
    SUBMIT: [SubcontractingOrderStatus.DRAFT],
    START: [SubcontractingOrderStatus.SUBMITTED],
    COMPLETE: [SubcontractingOrderStatus.IN_PROGRESS],
    CANCEL: [SubcontractingOrderStatus.DRAFT, SubcontractingOrderStatus.SUBMITTED, SubcontractingOrderStatus.IN_PROGRESS],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} subcontracting order from ${current}`);
  }

  switch (action) {
    case "SUBMIT":
      return SubcontractingOrderStatus.SUBMITTED;
    case "START":
      return SubcontractingOrderStatus.IN_PROGRESS;
    case "COMPLETE":
      return SubcontractingOrderStatus.COMPLETED;
    case "CANCEL":
      return SubcontractingOrderStatus.CANCELLED;
  }
}

export async function listSubcontractingOrders(ctx: PlatformRequestContext, input: unknown) {
  const parsed = subcontractingOrderListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid subcontracting order query", parsed.error.flatten());
  }

  const q = parsed.data;

  const where: Prisma.SubcontractingOrderWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.vendorId ? { vendorId: q.vendorId } : {}),
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
    prisma.subcontractingOrder.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        issueWarehouse: { select: { id: true, code: true, name: true } },
        items: {
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
    prisma.subcontractingOrder.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createSubcontractingOrder(ctx: PlatformRequestContext, input: unknown) {
  const parsed = subcontractingOrderCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid subcontracting order payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await Promise.all([
    assertVendor(ctx.companyId, payload.vendorId),
    assertProducts(
      ctx.companyId,
      payload.items.map((item) => item.itemId),
    ),
    assertWarehouse(ctx.companyId, payload.issueWarehouseId),
  ]);

  try {
    return await prisma.subcontractingOrder.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        status: SubcontractingOrderStatus.DRAFT,
        vendorId: payload.vendorId,
        issueWarehouseId: payload.issueWarehouseId,
        expectedDate: payload.expectedDate,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        items: {
          create: payload.items.map((item, index) => ({
            lineNo: index + 1,
            itemId: item.itemId,
            description: item.description,
            qtyOutward: item.qtyOutward,
          })),
        },
      },
      include: {
        vendor: { select: { id: true, name: true } },
        issueWarehouse: { select: { id: true, code: true, name: true } },
        items: {
          include: {
            item: { select: { id: true, sku: true, name: true, uom: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Subcontracting order number already exists for this company");
    }
    throw error;
  }
}

export async function applySubcontractingOrderAction(
  ctx: PlatformRequestContext,
  orderId: string,
  input: unknown,
) {
  const parsed = subcontractingOrderActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid subcontracting order action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const order = await prisma.subcontractingOrder.findFirst({
    where: { id: orderId, companyId: ctx.companyId },
    include: {
      items: true,
    },
  });

  if (!order) {
    throw new PlatformError("NOT_FOUND", "Subcontracting order not found");
  }

  const nextStatus = assertTransition(order.status, payload.action);

  if (payload.action === "COMPLETE") {
    const pending = order.items.some((item) => item.qtyReceived < item.qtyOutward);
    if (pending) {
      throw new PlatformError("CONFLICT", "Cannot complete subcontracting order before full receipt");
    }
  }

  await prisma.subcontractingOrder.update({
    where: { id: order.id },
    data: {
      status: nextStatus,
      notes: payload.reason ? [order.notes, payload.reason].filter(Boolean).join("\n") : order.notes,
      updatedBy: ctx.userId,
    },
  });

  return prisma.subcontractingOrder.findUniqueOrThrow({
    where: { id: order.id },
    include: {
      vendor: { select: { id: true, name: true } },
      issueWarehouse: { select: { id: true, code: true, name: true } },
      items: {
        include: {
          item: { select: { id: true, sku: true, name: true, uom: true } },
        },
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });
}
