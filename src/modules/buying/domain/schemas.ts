import {
  MaterialRequestStatus,
  PurchaseReceiptStatus,
  RequestForQuotationStatus,
  SupplierPaymentStatus,
  SupplierQuotationStatus,
} from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const materialRequestListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(MaterialRequestStatus).optional(),
});

export const materialRequestLineSchema = z.object({
  productId: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1),
  qtyRequested: z.number().int().positive(),
  preferredVendorId: z.string().trim().optional().nullable(),
});

export const materialRequestCreateSchema = z.object({
  number: z.string().trim().min(1),
  requestDate: z.coerce.date().optional(),
  requiredBy: z.coerce.date().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  lines: z.array(materialRequestLineSchema).min(1),
});

export const materialRequestActionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "CANCEL", "MARK_ORDERED"]),
  reason: z.string().trim().optional().nullable(),
});

export const rfqListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(RequestForQuotationStatus).optional(),
  materialRequestId: z.string().trim().optional(),
});

export const rfqLineSchema = z.object({
  materialRequestLineId: z.string().trim().optional().nullable(),
  productId: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1),
  qty: z.number().int().positive(),
  uom: z.string().trim().optional().nullable(),
});

export const rfqCreateSchema = z.object({
  number: z.string().trim().min(1),
  materialRequestId: z.string().trim().optional().nullable(),
  transactionDate: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  vendorIds: z.array(z.string().trim().min(1)).min(1),
  lines: z.array(rfqLineSchema).min(1),
});

export const rfqActionSchema = z.object({
  action: z.enum(["SEND", "CLOSE", "CANCEL"]),
});

export const supplierQuotationListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(SupplierQuotationStatus).optional(),
  vendorId: z.string().trim().optional(),
  requestForQuotationId: z.string().trim().optional(),
});

export const supplierQuotationLineSchema = z.object({
  requestForQuotationLineId: z.string().trim().optional().nullable(),
  productId: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1),
  qty: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  deliveryDays: z.number().int().positive().optional().nullable(),
});

export const supplierQuotationCreateSchema = z.object({
  number: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  requestForQuotationId: z.string().trim().optional().nullable(),
  quoteDate: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  lines: z.array(supplierQuotationLineSchema).min(1),
});

export const supplierQuotationActionSchema = z.object({
  action: z.enum(["SUBMIT", "ACCEPT", "REJECT", "EXPIRE"]),
});

export const purchaseReceiptListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(PurchaseReceiptStatus).optional(),
  vendorId: z.string().trim().optional(),
  purchaseOrderId: z.string().trim().optional(),
});

export const purchaseReceiptLineSchema = z.object({
  purchaseOrderLineId: z.string().trim().optional().nullable(),
  productId: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1),
  qtyReceived: z.number().int().positive(),
  acceptedQty: z.number().int().nonnegative().optional().nullable(),
  rejectedQty: z.number().int().nonnegative().optional().nullable(),
  unitCostMinor: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().trim().min(1).default("BDT"),
  destinationWarehouseId: z.string().trim().optional().nullable(),
  destinationLocationId: z.string().trim().optional().nullable(),
});

export const purchaseReceiptCreateSchema = z.object({
  number: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  purchaseOrderId: z.string().trim().optional().nullable(),
  supplierQuotationId: z.string().trim().optional().nullable(),
  destinationWarehouseId: z.string().trim().optional().nullable(),
  destinationLocationId: z.string().trim().optional().nullable(),
  receiptDate: z.coerce.date().optional(),
  notes: z.string().trim().optional().nullable(),
  lines: z.array(purchaseReceiptLineSchema).min(1),
});

export const purchaseReceiptActionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "POST", "CANCEL"]),
  idempotencyKey: z.string().trim().optional(),
  reason: z.string().trim().optional().nullable(),
});

export const supplierPaymentListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(SupplierPaymentStatus).optional(),
  vendorId: z.string().trim().optional(),
});

export const supplierPaymentAllocationSchema = z.object({
  purchaseBillId: z.string().trim().optional().nullable(),
  allocatedAmountCents: z.number().int().positive(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const supplierPaymentCreateSchema = z.object({
  number: z.string().trim().min(1).optional(),
  vendorId: z.string().trim().min(1),
  paymentDate: z.coerce.date().optional(),
  paidAmountCents: z.number().int().positive(),
  currency: z.string().trim().min(3).max(3).default("USD"),
  paidFromAccountId: z.string().trim().optional().nullable(),
  paidToAccountId: z.string().trim().optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  allocations: z.array(supplierPaymentAllocationSchema).default([]),
});

export const supplierPaymentActionSchema = z.object({
  action: z.enum(["SUBMIT", "POST", "CANCEL"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const payablesAgingQuerySchema = z.object({
  asOfDate: z.coerce.date().optional(),
  vendorId: z.string().trim().optional(),
  includeZeroBalance: z.coerce.boolean().default(false),
  persistSnapshot: z.coerce.boolean().default(false),
});
