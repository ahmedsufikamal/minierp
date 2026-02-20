import { Prisma, SalesOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createInventoryReservation, releaseInventoryReservation } from "@/modules/inventory/application/reservations.service";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  salesOrderActionSchema,
  salesOrderCreateSchema,
  salesOrderListQuerySchema,
} from "@/modules/selling/domain/schemas";

type SalesOrderAction = "SUBMIT" | "APPROVE" | "CANCEL" | "CLOSE";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function toInventoryContext(ctx: PlatformRequestContext): InventoryRequestContext {
  return {
    requestId: ctx.requestId,
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    userId: ctx.userId,
    role: "COMPANY_ADMIN",
    iamPermissions: ctx.permissions,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  };
}

async function assertOrderWarehouseAndLocation(
  ctx: PlatformRequestContext,
  warehouseId: string | null,
  locationId: string | null,
): Promise<void> {
  if (!warehouseId && !locationId) return;

  if (warehouseId) {
    const warehouse = await prisma.inventoryWarehouse.findFirst({
      where: { id: warehouseId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!warehouse) {
      throw new PlatformError("VALIDATION_ERROR", "Invalid reservationWarehouseId for this company");
    }
  }

  if (locationId) {
    const location = await prisma.inventoryWarehouseLocation.findFirst({
      where: {
        id: locationId,
        companyId: ctx.companyId,
        ...(warehouseId ? { warehouseId } : {}),
      },
      select: { id: true },
    });

    if (!location) {
      throw new PlatformError("VALIDATION_ERROR", "Invalid reservationLocationId for this company");
    }
  }
}

function assertTransition(current: SalesOrderStatus, action: SalesOrderAction): void {
  const allowed: Record<SalesOrderAction, SalesOrderStatus[]> = {
    SUBMIT: [SalesOrderStatus.DRAFT],
    APPROVE: [SalesOrderStatus.SUBMITTED],
    CANCEL: [SalesOrderStatus.DRAFT, SalesOrderStatus.SUBMITTED, SalesOrderStatus.APPROVED, SalesOrderStatus.PARTIALLY_DELIVERED],
    CLOSE: [SalesOrderStatus.APPROVED, SalesOrderStatus.PARTIALLY_DELIVERED, SalesOrderStatus.DELIVERED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} sales order from ${current}`);
  }
}

async function ensureCustomer(companyId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });

  if (!customer) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid customerId for this company");
  }
}

export async function listSalesOrders(ctx: PlatformRequestContext, input: unknown) {
  const parsed = salesOrderListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid sales order query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.SalesOrderWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.q
      ? {
          OR: [
            { number: { contains: q.q, mode: "insensitive" } },
            { notes: { contains: q.q, mode: "insensitive" } },
            { customer: { name: { contains: q.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        lines: {
          orderBy: [{ lineNo: "asc" }],
        },
      },
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createSalesOrder(ctx: PlatformRequestContext, input: unknown) {
  const parsed = salesOrderCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid sales order payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await ensureCustomer(ctx.companyId, payload.customerId);

  if (payload.sourceQuoteId) {
    const quote = await prisma.quote.findFirst({
      where: { id: payload.sourceQuoteId, companyId: ctx.companyId, customerId: payload.customerId },
      select: { id: true },
    });

    if (!quote) {
      throw new PlatformError("VALIDATION_ERROR", "Invalid sourceQuoteId for this customer/company");
    }
  }

  await assertOrderWarehouseAndLocation(
    ctx,
    payload.reservationWarehouseId ?? null,
    payload.reservationLocationId ?? null,
  );

  try {
    return await prisma.salesOrder.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        status: SalesOrderStatus.DRAFT,
        customerId: payload.customerId,
        sourceQuoteId: payload.sourceQuoteId,
        reservationWarehouseId: payload.reservationWarehouseId,
        reservationLocationId: payload.reservationLocationId,
        orderDate: payload.orderDate ?? new Date(),
        deliveryDate: payload.deliveryDate,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        lines: {
          create: payload.lines.map((line, index) => ({
            lineNo: index + 1,
            quoteLineId: line.quoteLineId,
            productId: line.productId,
            description: line.description,
            qtyOrdered: line.qtyOrdered,
            unitPriceCents: line.unitPriceCents,
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        lines: { orderBy: [{ lineNo: "asc" }] },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Sales order number already exists for this company");
    }
    throw error;
  }
}

async function reserveSalesOrderStock(ctx: PlatformRequestContext, orderId: string) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, companyId: ctx.companyId },
    include: {
      lines: {
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });

  if (!order) {
    throw new PlatformError("NOT_FOUND", "Sales order not found");
  }

  if (!order.reservationWarehouseId) {
    return;
  }

  const inventoryCtx = toInventoryContext(ctx);

  for (const line of order.lines) {
    if (!line.productId || line.reservationId) continue;
    const qtyToReserve = Math.max(line.qtyOrdered - line.qtyDelivered, 0);
    if (qtyToReserve <= 0) continue;

    const reservation = await createInventoryReservation(inventoryCtx, {
      itemId: line.productId,
      warehouseId: order.reservationWarehouseId,
      locationId: order.reservationLocationId,
      quantity: qtyToReserve,
      referenceType: "SALES_ORDER",
      referenceId: order.id,
      notes: `Sales Order ${order.number}`,
    });

    await prisma.salesOrderLine.update({
      where: { id: line.id },
      data: { reservationId: reservation.id },
    });
  }
}

async function releaseSalesOrderReservations(ctx: PlatformRequestContext, orderId: string, reason: string | null | undefined) {
  const lines = await prisma.salesOrderLine.findMany({
    where: {
      salesOrderId: orderId,
      reservationId: { not: null },
    },
    select: {
      reservationId: true,
    },
  });

  const inventoryCtx = toInventoryContext(ctx);

  for (const line of lines) {
    if (!line.reservationId) continue;

    try {
      await releaseInventoryReservation(inventoryCtx, line.reservationId, {
        reason: reason ?? "sales-order-cancelled",
        cancel: true,
      });
    } catch {
      // Reservation may already be consumed/released; cancellation should still proceed.
    }
  }
}

export async function applySalesOrderAction(ctx: PlatformRequestContext, salesOrderId: string, input: unknown) {
  const parsed = salesOrderActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid sales order action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const order = await prisma.salesOrder.findFirst({
    where: { id: salesOrderId, companyId: ctx.companyId },
    include: {
      customer: { select: { id: true, name: true } },
      lines: {
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });

  if (!order) {
    throw new PlatformError("NOT_FOUND", "Sales order not found");
  }

  assertTransition(order.status, payload.action);

  if (payload.action === "APPROVE") {
    await reserveSalesOrderStock(ctx, order.id);
  }

  if (payload.action === "CANCEL") {
    await releaseSalesOrderReservations(ctx, order.id, payload.reason);
  }

  const updated = await prisma.salesOrder.update({
    where: { id: order.id },
    data: {
      status:
        payload.action === "SUBMIT"
          ? SalesOrderStatus.SUBMITTED
          : payload.action === "APPROVE"
            ? SalesOrderStatus.APPROVED
            : payload.action === "CANCEL"
              ? SalesOrderStatus.CANCELLED
              : SalesOrderStatus.CLOSED,
      submittedAt: payload.action === "SUBMIT" ? new Date() : undefined,
      approvedAt: payload.action === "APPROVE" ? new Date() : undefined,
      cancelledAt: payload.action === "CANCEL" ? new Date() : undefined,
      closedAt: payload.action === "CLOSE" ? new Date() : undefined,
      updatedBy: ctx.userId,
    },
    include: {
      customer: { select: { id: true, name: true } },
      lines: {
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });

  return updated;
}
