import { DeliveryNoteStatus, Prisma, SalesOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyInventoryDocumentAction,
  createInventoryDocument,
} from "@/modules/inventory/application/documents.service";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  deliveryNoteActionSchema,
  deliveryNoteCreateSchema,
  deliveryNoteListQuerySchema,
} from "@/modules/selling/domain/schemas";

type DeliveryAction = "SUBMIT" | "APPROVE" | "POST" | "CANCEL";

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

async function ensureCustomer(companyId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });

  if (!customer) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid customerId for this company");
  }
}

async function assertWarehouseLocation(
  companyId: string,
  warehouseId: string | null,
  locationId: string | null,
  fieldLabel: string,
): Promise<void> {
  if (!warehouseId && !locationId) return;

  if (warehouseId) {
    const warehouse = await prisma.inventoryWarehouse.findFirst({
      where: { id: warehouseId, companyId },
      select: { id: true },
    });

    if (!warehouse) {
      throw new PlatformError("VALIDATION_ERROR", `Invalid ${fieldLabel} warehouse for this company`);
    }
  }

  if (locationId) {
    const location = await prisma.inventoryWarehouseLocation.findFirst({
      where: {
        id: locationId,
        companyId,
        ...(warehouseId ? { warehouseId } : {}),
      },
      select: { id: true },
    });

    if (!location) {
      throw new PlatformError("VALIDATION_ERROR", `Invalid ${fieldLabel} location for this company`);
    }
  }
}

function assertTransition(current: DeliveryNoteStatus, action: DeliveryAction): void {
  const allowed: Record<DeliveryAction, DeliveryNoteStatus[]> = {
    SUBMIT: [DeliveryNoteStatus.DRAFT],
    APPROVE: [DeliveryNoteStatus.SUBMITTED],
    POST: [DeliveryNoteStatus.APPROVED],
    CANCEL: [DeliveryNoteStatus.DRAFT, DeliveryNoteStatus.SUBMITTED, DeliveryNoteStatus.APPROVED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} delivery note from ${current}`);
  }
}

export async function listDeliveryNotes(ctx: PlatformRequestContext, input: unknown) {
  const parsed = deliveryNoteListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid delivery note query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.DeliveryNoteWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.salesOrderId ? { salesOrderId: q.salesOrderId } : {}),
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
    prisma.deliveryNote.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        salesOrder: { select: { id: true, number: true, status: true } },
        lines: {
          orderBy: [{ lineNo: "asc" }],
        },
      },
      orderBy: [{ deliveryDate: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.deliveryNote.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createDeliveryNote(ctx: PlatformRequestContext, input: unknown) {
  const parsed = deliveryNoteCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid delivery note payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await ensureCustomer(ctx.companyId, payload.customerId);
  await assertWarehouseLocation(
    ctx.companyId,
    payload.sourceWarehouseId ?? null,
    payload.sourceLocationId ?? null,
    "source",
  );

  let salesOrder: {
    id: string;
    customerId: string;
    lines: Array<{
      id: string;
      productId: string | null;
      description: string;
      reservationId: string | null;
    }>;
  } | null = null;

  if (payload.salesOrderId) {
    salesOrder = await prisma.salesOrder.findFirst({
      where: { id: payload.salesOrderId, companyId: ctx.companyId },
      select: {
        id: true,
        customerId: true,
        lines: {
          select: {
            id: true,
            productId: true,
            description: true,
            reservationId: true,
          },
        },
      },
    });

    if (!salesOrder) {
      throw new PlatformError("VALIDATION_ERROR", "Invalid salesOrderId for this company");
    }

    if (salesOrder.customerId !== payload.customerId) {
      throw new PlatformError("VALIDATION_ERROR", "Sales order customer mismatch");
    }
  }

  const normalizedLines = payload.lines.map((line, index) => {
    const sourceLine = line.salesOrderLineId
      ? salesOrder?.lines.find((candidate) => candidate.id === line.salesOrderLineId)
      : null;

    if (line.salesOrderLineId && !sourceLine) {
      throw new PlatformError("VALIDATION_ERROR", `Invalid salesOrderLineId at line ${index + 1}`);
    }

    if (!line.productId && !sourceLine?.productId) {
      throw new PlatformError("VALIDATION_ERROR", `Line ${index + 1} is missing productId`);
    }

    return {
      lineNo: index + 1,
      salesOrderLineId: line.salesOrderLineId,
      productId: line.productId ?? sourceLine?.productId ?? null,
      description: line.description || sourceLine?.description || "",
      qty: line.qty,
      unitCostMinor: line.unitCostMinor,
      currency: line.currency,
      sourceWarehouseId: line.sourceWarehouseId,
      sourceLocationId: line.sourceLocationId,
      reservationId: line.reservationId ?? sourceLine?.reservationId ?? null,
    };
  });

  return prisma.deliveryNote.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      number: payload.number,
      status: DeliveryNoteStatus.DRAFT,
      customerId: payload.customerId,
      salesOrderId: payload.salesOrderId,
      sourceWarehouseId: payload.sourceWarehouseId,
      sourceLocationId: payload.sourceLocationId,
      deliveryDate: payload.deliveryDate ?? new Date(),
      notes: payload.notes,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
      lines: {
        create: normalizedLines,
      },
    },
    include: {
      customer: { select: { id: true, name: true } },
      salesOrder: { select: { id: true, number: true, status: true } },
      lines: {
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });
}

async function refreshSalesOrderStatusInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  salesOrderId: string,
) {
  const order = await tx.salesOrder.findFirst({
    where: { id: salesOrderId, companyId },
    include: {
      lines: {
        select: {
          qtyOrdered: true,
          qtyDelivered: true,
        },
      },
    },
  });

  if (!order) return;

  const allDelivered = order.lines.length > 0 && order.lines.every((line) => line.qtyDelivered >= line.qtyOrdered);
  const anyDelivered = order.lines.some((line) => line.qtyDelivered > 0);

  const nextStatus = allDelivered
    ? SalesOrderStatus.DELIVERED
    : anyDelivered
      ? SalesOrderStatus.PARTIALLY_DELIVERED
      : order.status;

  if (nextStatus !== order.status) {
    await tx.salesOrder.update({
      where: { id: order.id },
      data: { status: nextStatus },
    });
  }
}

async function postDeliveryNote(
  ctx: PlatformRequestContext,
  note: Awaited<ReturnType<typeof prisma.deliveryNote.findFirst>>,
  idempotencyKey?: string,
) {
  if (!note) {
    throw new PlatformError("NOT_FOUND", "Delivery note not found");
  }

  if (note.lines.length === 0) {
    throw new PlatformError("VALIDATION_ERROR", "Delivery note has no lines");
  }

  const inventoryCtx = toInventoryContext(ctx);

  const inventoryDocument = await createInventoryDocument(inventoryCtx, {
    documentType: "ISSUE",
    number: `${note.number}-ISSUE`,
    sourceWarehouseId: note.sourceWarehouseId,
    sourceLocationId: note.sourceLocationId,
    documentDate: note.deliveryDate,
    externalRef: note.number,
    notes: `Delivery Note ${note.number}`,
    lines: note.lines.map((line) => {
      if (!line.productId) {
        throw new PlatformError("VALIDATION_ERROR", `Delivery note line ${line.lineNo} is missing productId`);
      }

      return {
        itemId: line.productId,
        description: line.description,
        quantity: line.qty,
        unitCostMinor: line.unitCostMinor ?? 0,
        currency: line.currency,
        sourceWarehouseId: line.sourceWarehouseId ?? note.sourceWarehouseId,
        sourceLocationId: line.sourceLocationId ?? note.sourceLocationId,
        reservationId: line.reservationId,
      };
    }),
  });

  await applyInventoryDocumentAction(inventoryCtx, inventoryDocument.id, {
    action: "SUBMIT",
  });
  await applyInventoryDocumentAction(inventoryCtx, inventoryDocument.id, {
    action: "APPROVE",
  });
  await applyInventoryDocumentAction(inventoryCtx, inventoryDocument.id, {
    action: "POST",
    idempotencyKey: idempotencyKey ?? crypto.randomUUID(),
  });

  await prisma.$transaction(async (tx) => {
    await tx.deliveryNote.update({
      where: { id: note.id },
      data: {
        status: DeliveryNoteStatus.POSTED,
        postedAt: new Date(),
        postedBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });

    for (const line of note.lines) {
      if (!line.salesOrderLineId) continue;
      await tx.salesOrderLine.update({
        where: { id: line.salesOrderLineId },
        data: {
          qtyDelivered: {
            increment: line.qty,
          },
        },
      });
    }

    if (note.salesOrderId) {
      await refreshSalesOrderStatusInTx(tx, ctx.companyId, note.salesOrderId);
    }

    await tx.outboxEvent.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        topic: "selling.delivery-note.posted",
        aggregateType: "DeliveryNote",
        aggregateId: note.id,
        payload: {
          deliveryNoteId: note.id,
          number: note.number,
          salesOrderId: note.salesOrderId,
          postedBy: ctx.userId,
        } as Prisma.InputJsonValue,
      },
    });
  });
}

export async function applyDeliveryNoteAction(ctx: PlatformRequestContext, deliveryNoteId: string, input: unknown) {
  const parsed = deliveryNoteActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid delivery note action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const note = await prisma.deliveryNote.findFirst({
    where: { id: deliveryNoteId, companyId: ctx.companyId },
    include: {
      customer: { select: { id: true, name: true } },
      salesOrder: { select: { id: true, number: true, status: true } },
      lines: {
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });

  if (!note) {
    throw new PlatformError("NOT_FOUND", "Delivery note not found");
  }

  assertTransition(note.status, payload.action);

  if (payload.action === "POST") {
    await postDeliveryNote(ctx, note, payload.idempotencyKey);
  } else {
    await prisma.deliveryNote.update({
      where: { id: note.id },
      data: {
        status:
          payload.action === "SUBMIT"
            ? DeliveryNoteStatus.SUBMITTED
            : payload.action === "APPROVE"
              ? DeliveryNoteStatus.APPROVED
              : DeliveryNoteStatus.CANCELLED,
        updatedBy: ctx.userId,
      },
    });
  }

  return prisma.deliveryNote.findFirst({
    where: { id: deliveryNoteId, companyId: ctx.companyId },
    include: {
      customer: { select: { id: true, name: true } },
      salesOrder: { select: { id: true, number: true, status: true } },
      lines: {
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });
}
