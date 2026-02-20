import { PosPaymentMethod, PosSaleStatus, PosShiftStatus } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const posProfileListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const posProfileCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  warehouseId: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const posShiftListQuerySchema = paginationSchema.extend({
  profileId: z.string().trim().optional(),
  status: z.nativeEnum(PosShiftStatus).optional(),
});

export const posShiftCreateSchema = z.object({
  number: z.string().trim().min(1).max(100),
  profileId: z.string().trim().min(1),
  openingCashMinor: z.number().int().nonnegative().default(0),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const posShiftActionSchema = z.object({
  action: z.enum(["OPEN", "CLOSE"]),
  closingCashMinor: z.number().int().nonnegative().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const posSaleListQuerySchema = paginationSchema.extend({
  profileId: z.string().trim().optional(),
  shiftId: z.string().trim().optional(),
  status: z.nativeEnum(PosSaleStatus).optional(),
});

export const posSaleLineSchema = z.object({
  productId: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1).max(300),
  qty: z.number().int().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
});

export const posSalePaymentSchema = z.object({
  method: z.nativeEnum(PosPaymentMethod),
  amountMinor: z.number().int().nonnegative(),
  referenceNo: z.string().trim().max(120).optional().nullable(),
});

export const posSaleCreateSchema = z.object({
  number: z.string().trim().min(1).max(100),
  profileId: z.string().trim().min(1),
  shiftId: z.string().trim().optional().nullable(),
  customerId: z.string().trim().optional().nullable(),
  saleDate: z.coerce.date().optional().nullable(),
  currency: z.string().trim().max(10).default("BDT"),
  notes: z.string().trim().max(1000).optional().nullable(),
  lines: z.array(posSaleLineSchema).min(1),
});

export const posSaleActionSchema = z.object({
  action: z.enum(["PAY", "VOID"]),
  payments: z.array(posSalePaymentSchema).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});
