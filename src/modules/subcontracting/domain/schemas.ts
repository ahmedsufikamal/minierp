import { SubcontractingOrderStatus, SubcontractingReceiptStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const subcontractingOrderListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(SubcontractingOrderStatus).optional(),
  vendorId: z.string().trim().optional(),
});

export const subcontractingOrderLineSchema = z.object({
  itemId: z.string().trim().min(1),
  description: z.string().trim().min(1).max(400),
  qtyOutward: z.number().int().positive(),
});

export const subcontractingOrderCreateSchema = z.object({
  number: z.string().trim().min(1).max(100),
  vendorId: z.string().trim().min(1),
  issueWarehouseId: z.string().trim().optional().nullable(),
  expectedDate: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(subcontractingOrderLineSchema).min(1),
});

export const subcontractingOrderActionSchema = z.object({
  action: z.enum(["SUBMIT", "START", "COMPLETE", "CANCEL"]),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const subcontractingReceiptListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(SubcontractingReceiptStatus).optional(),
  vendorId: z.string().trim().optional(),
  subcontractingOrderId: z.string().trim().optional(),
});

export const subcontractingReceiptItemSchema = z.object({
  orderItemId: z.string().trim().optional().nullable(),
  itemId: z.string().trim().min(1),
  description: z.string().trim().min(1).max(400),
  qtyReceived: z.number().int().positive(),
  qtyRejected: z.number().int().nonnegative().optional().nullable(),
});

export const subcontractingReceiptCreateSchema = z.object({
  number: z.string().trim().min(1).max(100),
  subcontractingOrderId: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  destinationWarehouseId: z.string().trim().optional().nullable(),
  receiptDate: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(subcontractingReceiptItemSchema).min(1),
});

export const subcontractingReceiptActionSchema = z.object({
  action: z.enum(["SUBMIT", "ACCEPT", "REJECT", "CANCEL"]),
  reason: z.string().trim().max(500).optional().nullable(),
});
