import { Prisma, PurchaseOrderStatus, PurchaseReceiptStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyInventoryDocumentAction,
  createInventoryDocument,
} from "@/modules/inventory/application/documents.service";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  purchaseReceiptActionSchema,
  purchaseReceiptCreateSchema,
  purchaseReceiptListQuerySchema,
} from "@/modules/buying/domain/schemas";

type PurchaseReceiptAction = "SUBMIT" | "APPROVE" | "POST" | "CANCEL";
type PurchaseReceiptForPosting = Prisma.PurchaseReceiptGetPayload<{
  include: {
    lines: true;
  };
}>;

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

function assertTransition(current: PurchaseReceiptStatus, action: PurchaseReceiptAction): void {
  const allowed: Record<PurchaseReceiptAction, PurchaseReceiptStatus[]> = {
    SUBMIT: [PurchaseReceiptStatus.DRAFT],
    APPROVE: [PurchaseReceiptStatus.SUBMITTED],
    POST: [PurchaseReceiptStatus.APPROVED],
    CANCEL: [PurchaseReceiptStatus.DRAFT, PurchaseReceiptStatus.SUBMITTED, PurchaseReceiptStatus.APPROVED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} purchase receipt from ${current}`);
  }
}

async function getReceiptTolerancePct(companyId: string): Promise<number> {
  const setting = await prisma.orgSetting.findUnique({
    where: {
      companyId_key: {
        companyId,
        key: "buying.receiptTolerancePct",
      },
    },
    select: { value: true },
  });

  if (!setting?.value) {
    return 0;
  }

  const parsed = Number.parseFloat(setting.value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

async function updatePurchaseOrderStatusInTx(tx: Prisma.TransactionClient, purchaseOrderId: string) {
  const order = await tx.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      lines: {
        select: {
          qtyOrdered: true,
          qtyReceived: true,
        },
      },
    },
  });

  if (!order) return;

  const allReceived = order.lines.length > 0 && order.lines.every((line) => line.qtyReceived >= line.qtyOrdered);
  const anyReceived = order.lines.some((line) => line.qtyReceived > 0);

  const nextStatus = allReceived
    ? PurchaseOrderStatus.RECEIVED
    : anyReceived
      ? PurchaseOrderStatus.PARTIALLY_RECEIVED
      : order.status;

  if (nextStatus !== order.status) {
    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { status: nextStatus },
    });
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

export async function listPurchaseReceipts(ctx: PlatformRequestContext, input: unknown) {
  const parsed = purchaseReceiptListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid purchase receipt query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.PurchaseReceiptWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.vendorId ? { vendorId: q.vendorId } : {}),
    ...(q.purchaseOrderId ? { purchaseOrderId: q.purchaseOrderId } : {}),
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
    prisma.purchaseReceipt.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, number: true, status: true } },
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            purchaseOrderLine: { select: { id: true, qtyOrdered: true, qtyReceived: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
      orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.purchaseReceipt.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createPurchaseReceipt(ctx: PlatformRequestContext, input: unknown) {
  const parsed = purchaseReceiptCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid purchase receipt payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const vendor = await prisma.vendor.findFirst({
    where: { id: payload.vendorId, companyId: ctx.companyId },
    select: { id: true },
  });

  if (!vendor) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid vendorId for this company");
  }

  await assertWarehouseLocation(
    ctx.companyId,
    payload.destinationWarehouseId ?? null,
    payload.destinationLocationId ?? null,
    "destination",
  );

  let purchaseOrderId: string | null = payload.purchaseOrderId ?? null;
  if (purchaseOrderId) {
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, companyId: ctx.companyId, vendorId: payload.vendorId },
      select: { id: true },
    });

    if (!purchaseOrder) {
      throw new PlatformError("VALIDATION_ERROR", "Invalid purchaseOrderId for this vendor/company");
    }
  }

  if (payload.supplierQuotationId) {
    const supplierQuotation = await prisma.supplierQuotation.findFirst({
      where: { id: payload.supplierQuotationId, companyId: ctx.companyId, vendorId: payload.vendorId },
      select: { id: true },
    });

    if (!supplierQuotation) {
      throw new PlatformError("VALIDATION_ERROR", "Invalid supplierQuotationId for this vendor/company");
    }
  }

  const normalizedLines = [] as Array<{
    lineNo: number;
    purchaseOrderLineId: string | null;
    productId: string | null;
    description: string;
    qtyReceived: number;
    acceptedQty: number | null;
    rejectedQty: number | null;
    unitCostMinor: number | null;
    currency: string;
    destinationWarehouseId: string | null;
    destinationLocationId: string | null;
  }>;

  for (const [index, line] of payload.lines.entries()) {
    let resolvedProductId = line.productId ?? null;
    let resolvedDescription = line.description;

    if (line.purchaseOrderLineId) {
      const poLine = await prisma.purchaseOrderLine.findFirst({
        where: {
          id: line.purchaseOrderLineId,
          ...(purchaseOrderId ? { orderId: purchaseOrderId } : {}),
          order: { companyId: ctx.companyId, vendorId: payload.vendorId },
        },
        select: {
          id: true,
          productId: true,
          description: true,
          orderId: true,
        },
      });

      if (!poLine) {
        throw new PlatformError("VALIDATION_ERROR", `Invalid purchaseOrderLineId at line ${index + 1}`);
      }

      purchaseOrderId = purchaseOrderId ?? poLine.orderId;
      resolvedProductId = resolvedProductId ?? poLine.productId;
      resolvedDescription = line.description || poLine.description;
    }

    if (resolvedProductId) {
      const product = await prisma.product.findFirst({
        where: { id: resolvedProductId, companyId: ctx.companyId },
        select: { id: true },
      });
      if (!product) {
        throw new PlatformError("VALIDATION_ERROR", `Invalid productId at line ${index + 1}`);
      }
    }

    if (!resolvedProductId) {
      throw new PlatformError("VALIDATION_ERROR", `Line ${index + 1} is missing productId`);
    }

    await assertWarehouseLocation(
      ctx.companyId,
      line.destinationWarehouseId ?? payload.destinationWarehouseId ?? null,
      line.destinationLocationId ?? payload.destinationLocationId ?? null,
      `line ${index + 1} destination`,
    );

    normalizedLines.push({
      lineNo: index + 1,
      purchaseOrderLineId: line.purchaseOrderLineId ?? null,
      productId: resolvedProductId,
      description: resolvedDescription,
      qtyReceived: line.qtyReceived,
      acceptedQty: line.acceptedQty ?? null,
      rejectedQty: line.rejectedQty ?? null,
      unitCostMinor: line.unitCostMinor ?? null,
      currency: line.currency,
      destinationWarehouseId: line.destinationWarehouseId ?? payload.destinationWarehouseId ?? null,
      destinationLocationId: line.destinationLocationId ?? payload.destinationLocationId ?? null,
    });
  }

  try {
    return await prisma.purchaseReceipt.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        number: payload.number,
        status: PurchaseReceiptStatus.DRAFT,
        vendorId: payload.vendorId,
        purchaseOrderId,
        supplierQuotationId: payload.supplierQuotationId,
        destinationWarehouseId: payload.destinationWarehouseId,
        destinationLocationId: payload.destinationLocationId,
        receiptDate: payload.receiptDate ?? new Date(),
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        lines: {
          create: normalizedLines,
        },
      },
      include: {
        vendor: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, number: true, status: true } },
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            purchaseOrderLine: { select: { id: true, qtyOrdered: true, qtyReceived: true } },
          },
          orderBy: [{ lineNo: "asc" }],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Purchase receipt number already exists for this company");
    }
    throw error;
  }
}

async function postPurchaseReceipt(
  ctx: PlatformRequestContext,
  receipt: PurchaseReceiptForPosting | null,
  idempotencyKey?: string,
) {
  if (!receipt) {
    throw new PlatformError("NOT_FOUND", "Purchase receipt not found");
  }

  if (receipt.lines.length === 0) {
    throw new PlatformError("VALIDATION_ERROR", "Purchase receipt has no lines");
  }

  const tolerancePct = await getReceiptTolerancePct(ctx.companyId);

  for (const line of receipt.lines) {
    if (!line.purchaseOrderLineId) continue;

    const poLine = await prisma.purchaseOrderLine.findFirst({
      where: {
        id: line.purchaseOrderLineId,
        order: { companyId: ctx.companyId },
      },
      select: {
        qtyOrdered: true,
        qtyReceived: true,
      },
    });

    if (!poLine) {
      throw new PlatformError("VALIDATION_ERROR", `Invalid purchaseOrderLineId at line ${line.lineNo}`);
    }

    const maxAllowed = Math.floor(poLine.qtyOrdered * (1 + tolerancePct / 100));
    if (poLine.qtyReceived + line.qtyReceived > maxAllowed) {
      throw new PlatformError(
        "CONFLICT",
        `Line ${line.lineNo} exceeds PO tolerance. Allowed cumulative receipt: ${maxAllowed}`,
      );
    }
  }

  const inventoryCtx = toInventoryContext(ctx);
  const inventoryDocument = await createInventoryDocument(inventoryCtx, {
    documentType: "RECEIPT",
    number: `${receipt.number}-RCV`,
    destinationWarehouseId: receipt.destinationWarehouseId,
    destinationLocationId: receipt.destinationLocationId,
    documentDate: receipt.receiptDate,
    externalRef: receipt.number,
    notes: `Purchase Receipt ${receipt.number}`,
    lines: receipt.lines.map((line) => {
      if (!line.productId) {
        throw new PlatformError("VALIDATION_ERROR", `Line ${line.lineNo} is missing productId`);
      }

      return {
        itemId: line.productId,
        description: line.description,
        quantity: line.qtyReceived,
        unitCostMinor: line.unitCostMinor ?? 0,
        currency: line.currency,
        destinationWarehouseId: line.destinationWarehouseId ?? receipt.destinationWarehouseId,
        destinationLocationId: line.destinationLocationId ?? receipt.destinationLocationId,
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
    await tx.purchaseReceipt.update({
      where: { id: receipt.id },
      data: {
        status: PurchaseReceiptStatus.POSTED,
        postedAt: new Date(),
        postedBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });

    for (const line of receipt.lines) {
      if (!line.purchaseOrderLineId) continue;
      await tx.purchaseOrderLine.update({
        where: { id: line.purchaseOrderLineId },
        data: {
          qtyReceived: {
            increment: line.qtyReceived,
          },
        },
      });
    }

    if (receipt.purchaseOrderId) {
      await updatePurchaseOrderStatusInTx(tx, receipt.purchaseOrderId);
    }

    await tx.outboxEvent.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        topic: "buying.purchase-receipt.posted",
        aggregateType: "PurchaseReceipt",
        aggregateId: receipt.id,
        payload: {
          purchaseReceiptId: receipt.id,
          number: receipt.number,
          purchaseOrderId: receipt.purchaseOrderId,
          postedBy: ctx.userId,
        } as Prisma.InputJsonValue,
      },
    });
  });
}

export async function applyPurchaseReceiptAction(
  ctx: PlatformRequestContext,
  purchaseReceiptId: string,
  input: unknown,
) {
  const parsed = purchaseReceiptActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid purchase receipt action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const receipt = await prisma.purchaseReceipt.findFirst({
    where: { id: purchaseReceiptId, companyId: ctx.companyId },
    include: {
      vendor: { select: { id: true, name: true } },
      purchaseOrder: { select: { id: true, number: true, status: true } },
      lines: {
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });

  if (!receipt) {
    throw new PlatformError("NOT_FOUND", "Purchase receipt not found");
  }

  assertTransition(receipt.status, payload.action);

  if (payload.action === "POST") {
    await postPurchaseReceipt(ctx, receipt, payload.idempotencyKey);
  } else {
    await prisma.purchaseReceipt.update({
      where: { id: receipt.id },
      data: {
        status:
          payload.action === "SUBMIT"
            ? PurchaseReceiptStatus.SUBMITTED
            : payload.action === "APPROVE"
              ? PurchaseReceiptStatus.APPROVED
              : PurchaseReceiptStatus.CANCELLED,
        updatedBy: ctx.userId,
      },
    });
  }

  return prisma.purchaseReceipt.findFirst({
    where: { id: purchaseReceiptId, companyId: ctx.companyId },
    include: {
      vendor: { select: { id: true, name: true } },
      purchaseOrder: { select: { id: true, number: true, status: true } },
      lines: {
        include: {
          product: { select: { id: true, sku: true, name: true } },
          purchaseOrderLine: { select: { id: true, qtyOrdered: true, qtyReceived: true } },
        },
        orderBy: [{ lineNo: "asc" }],
      },
    },
  });
}
