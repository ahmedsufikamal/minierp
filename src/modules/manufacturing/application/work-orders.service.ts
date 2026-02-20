import { Prisma, WorkOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createInventoryReservation,
  releaseInventoryReservation,
} from "@/modules/inventory/application/reservations.service";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  workOrderActionSchema,
  workOrderCreateSchema,
  workOrderListQuerySchema,
} from "@/modules/manufacturing/domain/schemas";

type WorkOrderAction = "RELEASE" | "START" | "COMPLETE" | "CANCEL";

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

async function assertWarehouse(companyId: string, warehouseId: string | null | undefined): Promise<void> {
  if (!warehouseId) return;

  const warehouse = await prisma.inventoryWarehouse.findFirst({
    where: { id: warehouseId, companyId },
    select: { id: true },
  });

  if (!warehouse) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid reservationWarehouseId for this company");
  }
}

async function assertRouting(companyId: string, routingId: string | null | undefined): Promise<void> {
  if (!routingId) return;

  const routing = await prisma.routing.findFirst({
    where: { id: routingId, companyId, isActive: true },
    select: { id: true },
  });

  if (!routing) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid routingId for this company");
  }
}

async function assertBom(companyId: string, bomId: string, itemId: string): Promise<void> {
  const bom = await prisma.bom.findFirst({
    where: {
      id: bomId,
      companyId,
      itemId,
      status: { in: ["ACTIVE", "DRAFT"] },
    },
    select: { id: true },
  });

  if (!bom) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid bomId/itemId for this company");
  }
}

function assertTransition(current: WorkOrderStatus, action: WorkOrderAction): WorkOrderStatus {
  const allowed: Record<WorkOrderAction, WorkOrderStatus[]> = {
    RELEASE: [WorkOrderStatus.DRAFT],
    START: [WorkOrderStatus.RELEASED],
    COMPLETE: [WorkOrderStatus.IN_PROGRESS],
    CANCEL: [WorkOrderStatus.DRAFT, WorkOrderStatus.RELEASED, WorkOrderStatus.IN_PROGRESS],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} work order from ${current}`);
  }

  switch (action) {
    case "RELEASE":
      return WorkOrderStatus.RELEASED;
    case "START":
      return WorkOrderStatus.IN_PROGRESS;
    case "COMPLETE":
      return WorkOrderStatus.COMPLETED;
    case "CANCEL":
      return WorkOrderStatus.CANCELLED;
  }
}

async function reserveWorkOrderMaterials(ctx: PlatformRequestContext, workOrderId: string): Promise<void> {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId: ctx.companyId },
    include: {
      bom: {
        include: {
          lines: {
            orderBy: [{ lineNo: "asc" }],
          },
        },
      },
    },
  });

  if (!workOrder) {
    throw new PlatformError("NOT_FOUND", "Work order not found");
  }

  if (!workOrder.reservationWarehouseId) {
    return;
  }

  const inventoryCtx = toInventoryContext(ctx);

  for (const line of workOrder.bom.lines) {
    const quantity = line.quantity * workOrder.qtyPlanned;
    if (quantity <= 0) continue;

    await createInventoryReservation(inventoryCtx, {
      itemId: line.itemId,
      warehouseId: workOrder.reservationWarehouseId,
      quantity,
      referenceType: "WORK_ORDER",
      referenceId: workOrder.id,
      notes: `Work Order ${workOrder.number} component reservation`,
    });
  }
}

async function releaseWorkOrderReservations(
  ctx: PlatformRequestContext,
  workOrderId: string,
  reason: string | null | undefined,
): Promise<void> {
  const reservations = await prisma.inventoryReservation.findMany({
    where: {
      companyId: ctx.companyId,
      referenceType: "WORK_ORDER",
      referenceId: workOrderId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const inventoryCtx = toInventoryContext(ctx);

  for (const reservation of reservations) {
    await releaseInventoryReservation(inventoryCtx, reservation.id, {
      reason: reason ?? "Work order finalized",
      cancel: false,
    });
  }
}

export async function listWorkOrders(ctx: PlatformRequestContext, input: unknown) {
  const parsed = workOrderListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid work order query", parsed.error.flatten());
  }

  const q = parsed.data;

  const where: Prisma.WorkOrderWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.bomId ? { bomId: q.bomId } : {}),
    ...(q.itemId ? { itemId: q.itemId } : {}),
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
    prisma.workOrder.findMany({
      where,
      include: {
        bom: { select: { id: true, code: true, status: true } },
        routing: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true, uom: true } },
        reservationWarehouse: { select: { id: true, code: true, name: true } },
        jobCards: {
          orderBy: [{ operationNo: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.workOrder.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createWorkOrder(ctx: PlatformRequestContext, input: unknown) {
  const parsed = workOrderCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid work order payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await Promise.all([
    assertBom(ctx.companyId, payload.bomId, payload.itemId),
    assertRouting(ctx.companyId, payload.routingId),
    assertWarehouse(ctx.companyId, payload.reservationWarehouseId),
  ]);

  try {
    return await prisma.workOrder.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        status: WorkOrderStatus.DRAFT,
        bomId: payload.bomId,
        routingId: payload.routingId,
        itemId: payload.itemId,
        qtyPlanned: payload.qtyPlanned,
        reservationWarehouseId: payload.reservationWarehouseId,
        plannedStart: payload.plannedStart,
        plannedEnd: payload.plannedEnd,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        bom: { select: { id: true, code: true, status: true } },
        routing: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true, uom: true } },
        reservationWarehouse: { select: { id: true, code: true, name: true } },
        jobCards: {
          orderBy: [{ operationNo: "asc" }],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Work order number already exists for this company");
    }
    throw error;
  }
}

export async function applyWorkOrderAction(ctx: PlatformRequestContext, workOrderId: string, input: unknown) {
  const parsed = workOrderActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid work order action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId: ctx.companyId },
    include: {
      jobCards: {
        select: { id: true, status: true },
      },
    },
  });

  if (!workOrder) {
    throw new PlatformError("NOT_FOUND", "Work order not found");
  }

  const nextStatus = assertTransition(workOrder.status, payload.action);

  if (payload.action === "RELEASE") {
    await reserveWorkOrderMaterials(ctx, workOrder.id);
  }

  if (payload.action === "COMPLETE") {
    const pendingCards = workOrder.jobCards.filter(
      (card) => card.status !== "COMPLETED" && card.status !== "CANCELLED",
    );
    if (pendingCards.length > 0) {
      throw new PlatformError("CONFLICT", "Cannot complete work order with pending job cards");
    }
  }

  if (payload.action === "COMPLETE" || payload.action === "CANCEL") {
    await releaseWorkOrderReservations(ctx, workOrder.id, payload.reason);
  }

  await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: {
      status: nextStatus,
      startedAt: payload.action === "START" ? new Date() : workOrder.startedAt,
      completedAt: payload.action === "COMPLETE" ? new Date() : workOrder.completedAt,
      qtyCompleted: payload.action === "COMPLETE" ? workOrder.qtyPlanned : workOrder.qtyCompleted,
      notes: payload.reason ? [workOrder.notes, payload.reason].filter(Boolean).join("\n") : workOrder.notes,
      updatedBy: ctx.userId,
    },
  });

  return prisma.workOrder.findUniqueOrThrow({
    where: { id: workOrder.id },
    include: {
      bom: { select: { id: true, code: true, status: true } },
      routing: { select: { id: true, code: true, name: true } },
      item: { select: { id: true, sku: true, name: true, uom: true } },
      reservationWarehouse: { select: { id: true, code: true, name: true } },
      jobCards: {
        orderBy: [{ operationNo: "asc" }],
      },
    },
  });
}
