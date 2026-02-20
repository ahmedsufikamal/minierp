import { AssetStatus, DepreciationMethod } from "@prisma/client";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const assetCategoryListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const assetCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  depreciationMethod: z.nativeEnum(DepreciationMethod).default(DepreciationMethod.STRAIGHT_LINE),
  usefulLifeMonths: z.number().int().positive(),
  isActive: z.boolean().optional(),
});

export const assetListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  categoryId: z.string().trim().optional(),
});

export const assetCreateSchema = z.object({
  assetNo: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  categoryId: z.string().trim().optional().nullable(),
  acquiredOn: z.coerce.date(),
  inServiceOn: z.coerce.date().optional().nullable(),
  costMinor: z.number().int().positive(),
  salvageMinor: z.number().int().nonnegative().default(0),
  usefulLifeMonths: z.number().int().positive(),
  depreciationMethod: z.nativeEnum(DepreciationMethod).default(DepreciationMethod.STRAIGHT_LINE),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const assetActionSchema = z.object({
  action: z.enum(["ACTIVATE", "START_MAINTENANCE", "POST_DEPRECIATION", "DISPOSE"]),
  postingDate: z.coerce.date().optional().nullable(),
  amountMinor: z.number().int().nonnegative().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});
