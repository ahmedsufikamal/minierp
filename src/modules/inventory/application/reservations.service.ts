import { InventoryReservationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  reservationCreateSchema,
  reservationListQuerySchema,
  reservationReleaseSchema,
} from "@/modules/inventory/application/schemas";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";
import {
  advisoryLockInventoryScopeInTx,
  withSerializableRetry,
} from "@/modules/inventory/infrastructure/tx";

function pageToSkip(page: number, limit: number) {
  return Math.max(0, (page - 1) * limit);
}

async function lockBalanceRow(
  tx: Prisma.TransactionClient,
  companyId: string,
  itemId: string,
  warehouseId: string,
  locationId: string | null,
): Promise<void> {
  await advisoryLockInventoryScopeInTx(tx, {
    companyId,
    itemId,
    warehouseId,
    locationId,
  });
}

async function lockReservationRow(
  tx: Prisma.TransactionClient,
  companyId: string,
  reservationId: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT 1
    FROM "InventoryReservation"
    WHERE "orgId" = ${companyId}
      AND "id" = ${reservationId}
    FOR UPDATE
  `;
}

type ReservationTarget = {
  itemId: string;
  warehouseId: string;
  locationId: string | null;
};

async function ensureReservationTarget(
  tx: Prisma.TransactionClient,
  companyId: string,
  target: ReservationTarget,
): Promise<void> {
  const [item, warehouse] = await Promise.all([
    tx.product.findFirst({
      where: { id: target.itemId, companyId },
      select: { id: true },
    }),
    tx.inventoryWarehouse.findFirst({
      where: { id: target.warehouseId, companyId },
      select: { id: true },
    }),
  ]);

  if (!item) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid itemId for reservation");
  }

  if (!warehouse) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid warehouseId for reservation");
  }

  if (target.locationId) {
    const location = await tx.inventoryWarehouseLocation.findFirst({
      where: {
        id: target.locationId,
        companyId,
        warehouseId: target.warehouseId,
      },
      select: { id: true },
    });

    if (!location) {
      throw new InventoryError("VALIDATION_ERROR", "Invalid locationId for reservation");
    }
  }
}

export async function listInventoryReservations(ctx: InventoryRequestContext, input: unknown) {
  const parsed = reservationListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid reservation query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.InventoryReservationWhereInput = {
    companyId: ctx.companyId,
    ...(q.itemId ? { itemId: q.itemId } : {}),
    ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.referenceType ? { referenceType: q.referenceType } : {}),
    ...(q.referenceId ? { referenceId: q.referenceId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.inventoryReservation.findMany({
      where,
      include: {
        item: { select: { id: true, sku: true, name: true, uom: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.inventoryReservation.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createInventoryReservation(ctx: InventoryRequestContext, input: unknown) {
  const parsed = reservationCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid reservation payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const created = await withSerializableRetry(async () =>
    prisma.$transaction(
      async (tx) => {
      const target = {
        itemId: payload.itemId,
        warehouseId: payload.warehouseId,
        locationId: payload.locationId ?? null,
      };

      await ensureReservationTarget(tx, ctx.companyId, target);
      await lockBalanceRow(tx, ctx.companyId, target.itemId, target.warehouseId, target.locationId);

      const balance = await tx.inventoryStockBalance.findFirst({
        where: {
          companyId: ctx.companyId,
          itemId: target.itemId,
          warehouseId: target.warehouseId,
          locationId: target.locationId,
        },
        select: {
          id: true,
          onHand: true,
          reserved: true,
        },
      });

      const availableQty = (balance?.onHand ?? 0) - (balance?.reserved ?? 0);
      if (availableQty < payload.quantity) {
        throw new InventoryError(
          "CONFLICT",
          `Insufficient available stock to reserve ${payload.quantity}. Available: ${availableQty}`,
        );
      }

      if (!balance) {
        throw new InventoryError("CONFLICT", "Cannot reserve stock without an existing stock balance row");
      }

      await tx.inventoryStockBalance.update({
        where: { id: balance.id },
        data: {
          reserved: balance.reserved + payload.quantity,
        },
      });

      return tx.inventoryReservation.create({
        data: {
          companyId: ctx.companyId,
          itemId: target.itemId,
          warehouseId: target.warehouseId,
          locationId: target.locationId,
          quantity: payload.quantity,
          fulfilledQty: 0,
          status: InventoryReservationStatus.ACTIVE,
          referenceType: payload.referenceType,
          referenceId: payload.referenceId,
          notes: payload.notes,
          metadata: (payload.metadata ?? null) as Prisma.InputJsonValue,
          createdBy: ctx.userId,
        },
        include: {
          item: { select: { id: true, sku: true, name: true, uom: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          location: { select: { id: true, code: true, name: true } },
        },
      });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    ),
  );

  await writeInventoryAudit(ctx, {
    action: "RESERVATION_CREATED",
    entityType: "InventoryReservation",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function releaseInventoryReservation(
  ctx: InventoryRequestContext,
  reservationId: string,
  input: unknown,
) {
  const parsed = reservationReleaseSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid reservation release payload", parsed.error.flatten());
  }

  const action = parsed.data.cancel ? "RESERVATION_CANCELLED" : "RESERVATION_RELEASED";

  const released = await withSerializableRetry(async () =>
    prisma.$transaction(
      async (tx) => {
      await lockReservationRow(tx, ctx.companyId, reservationId);

      const existing = await tx.inventoryReservation.findFirst({
        where: { id: reservationId, companyId: ctx.companyId },
      });

      if (!existing) {
        throw new InventoryError("NOT_FOUND", "Reservation not found");
      }

      if (existing.status !== InventoryReservationStatus.ACTIVE) {
        throw new InventoryError("CONFLICT", "Only active reservations can be released");
      }

      const remainingQty = Math.max(existing.quantity - existing.fulfilledQty, 0);

      await lockBalanceRow(
        tx,
        ctx.companyId,
        existing.itemId,
        existing.warehouseId,
        existing.locationId ?? null,
      );

      const balance = await tx.inventoryStockBalance.findFirst({
        where: {
          companyId: ctx.companyId,
          itemId: existing.itemId,
          warehouseId: existing.warehouseId,
          locationId: existing.locationId,
        },
        select: { id: true, reserved: true },
      });

      if (balance) {
        await tx.inventoryStockBalance.update({
          where: { id: balance.id },
          data: {
            reserved: Math.max(balance.reserved - remainingQty, 0),
          },
        });
      }

      return tx.inventoryReservation.update({
        where: { id: existing.id },
        data: {
          status: parsed.data.cancel ? InventoryReservationStatus.CANCELLED : InventoryReservationStatus.RELEASED,
          releasedAt: new Date(),
          releasedBy: ctx.userId,
          metadata: {
            ...(typeof existing.metadata === "object" && existing.metadata ? (existing.metadata as Record<string, unknown>) : {}),
            releaseReason: parsed.data.reason ?? null,
          } as Prisma.InputJsonValue,
        },
        include: {
          item: { select: { id: true, sku: true, name: true, uom: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          location: { select: { id: true, code: true, name: true } },
        },
      });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    ),
  );

  await writeInventoryAudit(ctx, {
    action,
    entityType: "InventoryReservation",
    entityId: reservationId,
    after: released,
    metadata: { reason: parsed.data.reason ?? null },
  });

  return released;
}

export async function consumeInventoryReservationInTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    reservationId: string;
    itemId: string;
    warehouseId: string;
    locationId: string | null;
    quantity: number;
    userId: string;
  },
): Promise<{
  reservationId: string;
  consumedQty: number;
  status: InventoryReservationStatus;
  remainingQty: number;
}> {
  if (params.quantity <= 0) {
    return {
      reservationId: params.reservationId,
      consumedQty: 0,
      status: InventoryReservationStatus.ACTIVE,
      remainingQty: 0,
    };
  }

  await lockReservationRow(tx, params.companyId, params.reservationId);

  const reservation = await tx.inventoryReservation.findFirst({
    where: { id: params.reservationId, companyId: params.companyId },
  });

  if (!reservation) {
    throw new InventoryError("NOT_FOUND", "Reservation not found");
  }

  if (reservation.status !== InventoryReservationStatus.ACTIVE) {
    throw new InventoryError("CONFLICT", "Reservation is not active");
  }

  if (reservation.itemId !== params.itemId) {
    throw new InventoryError("VALIDATION_ERROR", "Reservation item mismatch");
  }

  if (reservation.warehouseId !== params.warehouseId) {
    throw new InventoryError("VALIDATION_ERROR", "Reservation warehouse mismatch");
  }

  if ((reservation.locationId ?? null) !== params.locationId) {
    throw new InventoryError("VALIDATION_ERROR", "Reservation location mismatch");
  }

  const remainingQty = reservation.quantity - reservation.fulfilledQty;
  if (remainingQty < params.quantity) {
    throw new InventoryError(
      "CONFLICT",
      `Reservation quantity exceeded. Remaining reserved quantity: ${remainingQty}`,
    );
  }

  const nextFulfilled = reservation.fulfilledQty + params.quantity;
  const nextStatus =
    nextFulfilled >= reservation.quantity
      ? InventoryReservationStatus.CONSUMED
      : InventoryReservationStatus.ACTIVE;

  const updated = await tx.inventoryReservation.update({
    where: { id: reservation.id },
    data: {
      fulfilledQty: nextFulfilled,
      status: nextStatus,
      ...(nextStatus === InventoryReservationStatus.CONSUMED
        ? {
            releasedAt: new Date(),
            releasedBy: params.userId,
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      quantity: true,
      fulfilledQty: true,
    },
  });

  return {
    reservationId: updated.id,
    consumedQty: params.quantity,
    status: updated.status,
    remainingQty: Math.max(updated.quantity - updated.fulfilledQty, 0),
  };
}
