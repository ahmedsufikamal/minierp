import { Prisma, SubcontractingOrderStatus, SubcontractingReceiptStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  subcontractingReceiptActionSchema,
  subcontractingReceiptCreateSchema,
  subcontractingReceiptListQuerySchema,
} from "@/modules/subcontracting/domain/schemas";

type SubcontractingReceiptAction = "SUBMIT" | "ACCEPT" | "REJECT" | "CANCEL";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertWarehouse(companyId: string, warehouseId: string | null | undefined): Promise<void> {
  if (!warehouseId) return;
  const warehouse = await prisma.inventoryWarehouse.findFirst({
    where: { id: warehouseId, companyId },
    select: { id: true },
  });
  if (!warehouse) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid destinationWarehouseId for this company");
  }
}

function assertTransition(current: SubcontractingReceiptStatus, action: SubcontractingReceiptAction): SubcontractingReceiptStatus {
  const allowed: Record<SubcontractingReceiptAction, SubcontractingReceiptStatus[]> = {
    SUBMIT: [SubcontractingReceiptStatus.DRAFT],
    ACCEPT: [SubcontractingReceiptStatus.SUBMITTED],
    REJECT: [SubcontractingReceiptStatus.SUBMITTED],
    CANCEL: [SubcontractingReceiptStatus.DRAFT, SubcontractingReceiptStatus.SUBMITTED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} subcontracting receipt from ${current}`);
  }

  switch (action) {
    case "SUBMIT":
      return SubcontractingReceiptStatus.SUBMITTED;
    case "ACCEPT":
      return SubcontractingReceiptStatus.ACCEPTED;
    case "REJECT":
      return SubcontractingReceiptStatus.REJECTED;
    case "CANCEL":
      return SubcontractingReceiptStatus.CANCELLED;
  }
}

async function recomputeOrderStatus(
  tx: Prisma.TransactionClient,
  companyId: string,
  orderId: string,
): Promise<void> {
  const items = await tx.subcontractingOrderItem.findMany({
    where: { orderId },
    select: {
      qtyOutward: true,
      qtyReceived: true,
    },
  });

  if (items.length === 0) return;

  const allCompleted = items.every((item) => item.qtyReceived >= item.qtyOutward);
  const anyReceived = items.some((item) => item.qtyReceived > 0);

  await tx.subcontractingOrder.update({
    where: { id: orderId, companyId },
    data: {
      status: allCompleted
        ? SubcontractingOrderStatus.COMPLETED
        : anyReceived
          ? SubcontractingOrderStatus.IN_PROGRESS
          : SubcontractingOrderStatus.SUBMITTED,
    },
  });
}

async function ensureNoFailedInspections(companyId: string, receiptId: string): Promise<void> {
  const failed = await prisma.qualityInspection.count({
    where: {
      companyId,
      referenceType: "SUBCONTRACTING_RECEIPT",
      referenceId: receiptId,
      status: "FAILED",
    },
  });

  if (failed > 0) {
    throw new PlatformError("CONFLICT", "Cannot accept subcontracting receipt while failed inspections exist");
  }
}

export async function listSubcontractingReceipts(ctx: PlatformRequestContext, input: unknown) {
  const parsed = subcontractingReceiptListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid subcontracting receipt query", parsed.error.flatten());
  }

  const q = parsed.data;

  const where: Prisma.SubcontractingReceiptWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.vendorId ? { vendorId: q.vendorId } : {}),
    ...(q.subcontractingOrderId ? { subcontractingOrderId: q.subcontractingOrderId } : {}),
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
    prisma.subcontractingReceipt.findMany({
      where,
      include: {
        subcontractingOrder: { select: { id: true, number: true, status: true } },
        vendor: { select: { id: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        items: {
          include: {
            orderItem: { select: { id: true, lineNo: true, qtyOutward: true, qtyReceived: true } },
            item: { select: { id: true, sku: true, name: true, uom: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.subcontractingReceipt.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createSubcontractingReceipt(ctx: PlatformRequestContext, input: unknown) {
  const parsed = subcontractingReceiptCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid subcontracting receipt payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const [order, vendor, productCount] = await Promise.all([
    prisma.subcontractingOrder.findFirst({
      where: {
        id: payload.subcontractingOrderId,
        companyId: ctx.companyId,
      },
      select: { id: true, vendorId: true, status: true },
    }),
    prisma.vendor.findFirst({
      where: { id: payload.vendorId, companyId: ctx.companyId },
      select: { id: true },
    }),
    prisma.product.count({
      where: {
        companyId: ctx.companyId,
        id: { in: [...new Set(payload.items.map((item) => item.itemId))] },
      },
    }),
  ]);

  if (!order) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid subcontractingOrderId for this company");
  }

  if (!vendor) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid vendorId for this company");
  }

  if (order.vendorId !== payload.vendorId) {
    throw new PlatformError("VALIDATION_ERROR", "Receipt vendor must match subcontracting order vendor");
  }

  if (productCount !== [...new Set(payload.items.map((item) => item.itemId))].length) {
    throw new PlatformError("VALIDATION_ERROR", "One or more receipt item IDs are invalid");
  }

  await assertWarehouse(ctx.companyId, payload.destinationWarehouseId);

  try {
    return await prisma.subcontractingReceipt.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        status: SubcontractingReceiptStatus.DRAFT,
        subcontractingOrderId: payload.subcontractingOrderId,
        vendorId: payload.vendorId,
        destinationWarehouseId: payload.destinationWarehouseId,
        receiptDate: payload.receiptDate ?? new Date(),
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        items: {
          create: payload.items.map((item, index) => ({
            lineNo: index + 1,
            orderItemId: item.orderItemId,
            itemId: item.itemId,
            description: item.description,
            qtyReceived: item.qtyReceived,
            qtyRejected: item.qtyRejected ?? 0,
          })),
        },
      },
      include: {
        subcontractingOrder: { select: { id: true, number: true, status: true } },
        vendor: { select: { id: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        items: {
          include: {
            orderItem: { select: { id: true, lineNo: true, qtyOutward: true, qtyReceived: true } },
            item: { select: { id: true, sku: true, name: true, uom: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Subcontracting receipt number already exists for this company");
    }
    throw error;
  }
}

export async function applySubcontractingReceiptAction(
  ctx: PlatformRequestContext,
  receiptId: string,
  input: unknown,
) {
  const parsed = subcontractingReceiptActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid subcontracting receipt action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const receipt = await prisma.subcontractingReceipt.findFirst({
    where: {
      id: receiptId,
      companyId: ctx.companyId,
    },
    include: {
      items: {
        orderBy: [{ lineNo: "asc" }],
      },
      subcontractingOrder: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!receipt) {
    throw new PlatformError("NOT_FOUND", "Subcontracting receipt not found");
  }

  const nextStatus = assertTransition(receipt.status, payload.action);

  if (payload.action === "ACCEPT") {
    await ensureNoFailedInspections(ctx.companyId, receipt.id);

    for (const line of receipt.items) {
      if (!line.orderItemId) {
        throw new PlatformError("VALIDATION_ERROR", "Each accepted receipt line must reference an orderItemId");
      }

      const orderItem = receipt.subcontractingOrder.items.find((item) => item.id === line.orderItemId);
      if (!orderItem) {
        throw new PlatformError("VALIDATION_ERROR", "Receipt line orderItemId does not belong to the linked order");
      }

      if (orderItem.qtyReceived + line.qtyReceived > orderItem.qtyOutward) {
        throw new PlatformError("CONFLICT", "Receipt quantity exceeds subcontracting order line quantity");
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.subcontractingReceipt.update({
      where: { id: receipt.id },
      data: {
        status: nextStatus,
        notes: payload.reason ? [receipt.notes, payload.reason].filter(Boolean).join("\n") : receipt.notes,
        updatedBy: ctx.userId,
      },
    });

    if (payload.action === "ACCEPT") {
      for (const line of receipt.items) {
        if (!line.orderItemId) continue;
        await tx.subcontractingOrderItem.update({
          where: { id: line.orderItemId },
          data: {
            qtyReceived: {
              increment: line.qtyReceived,
            },
          },
        });
      }

      await recomputeOrderStatus(tx, ctx.companyId, receipt.subcontractingOrderId);

      await tx.outboxEvent.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          topic: "subcontracting.receipt.accepted",
          aggregateType: "SubcontractingReceipt",
          aggregateId: receipt.id,
          payload: {
            subcontractingReceiptId: receipt.id,
            subcontractingOrderId: receipt.subcontractingOrderId,
            acceptedBy: ctx.userId,
          } as Prisma.InputJsonValue,
        },
      });
    }
  });

  return prisma.subcontractingReceipt.findUniqueOrThrow({
    where: { id: receipt.id },
    include: {
      subcontractingOrder: { select: { id: true, number: true, status: true } },
      vendor: { select: { id: true, name: true } },
      destinationWarehouse: { select: { id: true, code: true, name: true } },
      items: {
        include: {
          orderItem: { select: { id: true, lineNo: true, qtyOutward: true, qtyReceived: true } },
          item: { select: { id: true, sku: true, name: true, uom: true } },
        },
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });
}
