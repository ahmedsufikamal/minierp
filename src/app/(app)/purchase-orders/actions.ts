"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { success, failure } from "@/lib/action-result";
import { handlePrismaUniqueConflict } from "@/lib/prisma-errors";

const LineSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  unitPriceCents: z.coerce.number().int().nonnegative(),
});

const CreatePOSchema = z.object({
  vendorId: z.string().min(1),
  number: z.string().min(1),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  linesJson: z.string().min(2),
});

const POStatuses = ["DRAFT", "SENT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"] as const;

function toDateOrUndefined(v?: string) {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function createPurchaseOrder(formData: FormData): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();

  const parsed = CreatePOSchema.safeParse({
    vendorId: formData.get("vendorId"),
    number: formData.get("number"),
    orderDate: formData.get("orderDate"),
    expectedDate: formData.get("expectedDate"),
    notes: formData.get("notes"),
    linesJson: formData.get("linesJson"),
  });

  if (!parsed.success) return failure(parsed.error.flatten().fieldErrors);

  const { vendorId, number, orderDate, expectedDate, notes, linesJson } = parsed.data;

  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(linesJson);
  } catch {
    return failure({ linesJson: ["Invalid line items JSON"] });
  }

  const linesResult = z.array(LineSchema).safeParse(linesRaw);
  if (!linesResult.success) return failure({ lines: ["Invalid line items"] });
  const lines = linesResult.data;
  if (lines.length === 0) return failure({ lines: ["Order must have at least 1 line"] });

  const orderDateValue = toDateOrUndefined(orderDate) ?? new Date();
  const expectedDateValue = toDateOrUndefined(expectedDate);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.create({
        data: {
          companyId,
          vendorId,
          number,
          orderDate: orderDateValue,
          expectedDate: expectedDateValue ?? null,
          notes: notes?.trim() ? notes.trim() : null,
          lines: {
            create: lines.map((l) => ({
              productId: l.productId || null,
              description: l.description,
              qtyOrdered: l.qty,
              unitPriceCents: l.unitPriceCents,
            })),
          },
        },
      });
    });
  } catch (e) {
    const conflict = handlePrismaUniqueConflict(e, "number");
    if (conflict) return conflict;
    throw e;
  }

  revalidatePath("/purchase-orders");
  return success();
}

export async function updatePurchaseOrderStatus(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();
  const status = formData.get("status");
  const parsed = z.enum(POStatuses).safeParse(status);
  if (!parsed.success) return failure("Invalid status");

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!order) return failure("Purchase order not found");

  await prisma.purchaseOrder.update({
    where: { id },
    data: { status: parsed.data },
  });
  revalidatePath("/purchase-orders");
  return success();
}

export async function receivePurchaseOrderLine(
  lineId: string,
  qtyReceived: number,
): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();
  if (qtyReceived <= 0) return failure("Quantity must be positive");

  const line = await prisma.purchaseOrderLine.findFirst({
    where: { id: lineId, order: { companyId } },
    include: { order: true, product: true },
  });
  if (!line) return failure("Line not found");
  if (!line.productId) return failure("Line has no product to receive");
  const remaining = line.qtyOrdered - line.qtyReceived;
  if (qtyReceived > remaining) return failure(`Max remaining to receive: ${remaining}`);

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderLine.update({
      where: { id: lineId },
      data: { qtyReceived: line.qtyReceived + qtyReceived },
    });
    await tx.inventoryMove.create({
      data: {
        companyId,
        productId: line.productId,
        type: "IN",
        qty: qtyReceived,
        note: `PO ${line.order.number} received`,
      },
    });
    const updated = await tx.purchaseOrderLine.aggregate({
      where: { orderId: line.orderId },
      _sum: { qtyReceived: true },
      _count: { id: true },
    });
    const totalOrdered = await tx.purchaseOrderLine.aggregate({
      where: { orderId: line.orderId },
      _sum: { qtyOrdered: true },
    });
    const allReceived =
      (updated._sum.qtyReceived ?? 0) >= (totalOrdered._sum.qtyOrdered ?? 0);
    await tx.purchaseOrder.update({
      where: { id: line.orderId },
      data: {
        status: allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
      },
    });
  });

  revalidatePath("/purchase-orders");
  revalidatePath("/inventory");
  return success();
}

export async function deletePurchaseOrder(id: string): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();
  const order = await prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    select: { id: true, status: true },
  });
  if (!order) return failure("Purchase order not found");
  if (order.status !== "DRAFT" && order.status !== "CANCELLED") {
    return failure("Only DRAFT or CANCELLED orders can be deleted");
  }

  await prisma.purchaseOrder.delete({ where: { id } });
  revalidatePath("/purchase-orders");
  return success();
}

export async function convertPurchaseOrderToBill(
  orderId: string,
  billNumber: string,
): Promise<ActionResult> {
  const companyId = await getCompanyIdOrUserId();

  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, companyId },
    include: { lines: true },
  });
  if (!order) return failure("Purchase order not found");
  if (order.status !== "RECEIVED" && order.status !== "PARTIALLY_RECEIVED") {
    return failure("Only received orders can be converted to a bill");
  }

  const existing = await prisma.purchaseBill.findFirst({
    where: { companyId, number: billNumber },
  });
  if (existing) return failure("Bill number already exists");

  await prisma.$transaction(async (tx) => {
    await tx.purchaseBill.create({
      data: {
        companyId,
        vendorId: order.vendorId,
        number: billNumber,
        billDate: order.orderDate,
        notes: order.notes,
        status: "DRAFT",
        lines: {
          create: order.lines.map((l) => ({
            productId: l.productId,
            description: l.description,
            qty: l.qtyReceived,
            unitPriceCents: l.unitPriceCents,
          })),
        },
      },
    });
  });

  revalidatePath("/purchase-orders");
  revalidatePath("/bills");
  return success();
}
