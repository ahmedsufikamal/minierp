import { DeliveryNoteStatus, SalesOrderStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const salesOrderListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(SalesOrderStatus).optional(),
  customerId: z.string().trim().optional(),
});

export const salesOrderLineSchema = z.object({
  quoteLineId: z.string().trim().optional().nullable(),
  productId: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1),
  qtyOrdered: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
});

export const salesOrderCreateSchema = z.object({
  number: z.string().trim().min(1),
  customerId: z.string().trim().min(1),
  sourceQuoteId: z.string().trim().optional().nullable(),
  reservationWarehouseId: z.string().trim().optional().nullable(),
  reservationLocationId: z.string().trim().optional().nullable(),
  orderDate: z.coerce.date().optional(),
  deliveryDate: z.coerce.date().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  lines: z.array(salesOrderLineSchema).min(1),
});

export const salesOrderActionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "CANCEL", "CLOSE"]),
  reason: z.string().trim().optional().nullable(),
});

export const deliveryNoteListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(DeliveryNoteStatus).optional(),
  customerId: z.string().trim().optional(),
  salesOrderId: z.string().trim().optional(),
});

export const deliveryNoteLineSchema = z.object({
  salesOrderLineId: z.string().trim().optional().nullable(),
  productId: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1),
  qty: z.number().int().positive(),
  unitCostMinor: z.number().int().optional().nullable(),
  currency: z.string().trim().min(1).default("BDT"),
  sourceWarehouseId: z.string().trim().optional().nullable(),
  sourceLocationId: z.string().trim().optional().nullable(),
  reservationId: z.string().trim().optional().nullable(),
});

export const deliveryNoteCreateSchema = z.object({
  number: z.string().trim().min(1),
  customerId: z.string().trim().min(1),
  salesOrderId: z.string().trim().optional().nullable(),
  sourceWarehouseId: z.string().trim().optional().nullable(),
  sourceLocationId: z.string().trim().optional().nullable(),
  deliveryDate: z.coerce.date().optional(),
  notes: z.string().trim().optional().nullable(),
  lines: z.array(deliveryNoteLineSchema).min(1),
});

export const deliveryNoteActionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "POST", "CANCEL"]),
  idempotencyKey: z.string().trim().optional(),
  reason: z.string().trim().optional().nullable(),
});
