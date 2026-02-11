import { z } from "zod";
import {
  InventoryAttachmentEntityType,
  InventoryCustomFieldEntityType,
  InventoryCustomFieldType,
  InventoryDocumentStatus,
  InventoryDocumentType,
  InventoryPresetScope,
} from "@prisma/client";
import { workflowConfigSchema } from "@/modules/inventory/domain/workflow";

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(25),
});

export const itemListQuerySchema = paginationSchema.extend({
  q: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeCustom: z.coerce.boolean().default(true),
});

export const itemUpsertSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  brandId: z.string().min(1),
  categoryId: z.string().optional().nullable(),
  subCategoryId: z.string().optional().nullable(),
  uom: z.string().default("pcs"),
  unitCostMinor: z.number().int().nonnegative().default(0),
  priceCents: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().default(true),
  identifiers: z
    .array(
      z.object({
        kind: z.string().min(1),
        value: z.string().min(1),
        isPrimary: z.boolean().default(false),
      }),
    )
    .default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export const bulkCustomFieldUpdateSchema = z.object({
  entityType: z.nativeEnum(InventoryCustomFieldEntityType),
  updates: z.array(
    z.object({
      entityId: z.string().min(1),
      fields: z.record(z.string(), z.unknown()),
    }),
  ),
});

export const customFieldDefinitionSchema = z.object({
  entityType: z.nativeEnum(InventoryCustomFieldEntityType),
  key: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().min(1),
  description: z.string().optional().nullable(),
  fieldType: z.nativeEnum(InventoryCustomFieldType),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  indexed: z.boolean().default(false),
  showInList: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  validationRules: z.record(z.string(), z.unknown()).optional(),
  visibilityRoles: z.array(z.string()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const viewPresetSchema = z.object({
  entity: z.string().min(1),
  name: z.string().min(1),
  scope: z.nativeEnum(InventoryPresetScope).default(InventoryPresetScope.USER),
  role: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
  config: z.record(z.string(), z.unknown()),
});

export const workflowDefinitionSchema = z.object({
  documentType: z.nativeEnum(InventoryDocumentType),
  name: z.string().min(1),
  isActive: z.boolean().default(true),
  config: workflowConfigSchema,
});

export const labelTemplateSchema = z.object({
  name: z.string().min(1),
  paperType: z.enum(["A4", "THERMAL"]),
  widthMm: z.number().positive().optional().nullable(),
  heightMm: z.number().positive().optional().nullable(),
  isDefault: z.boolean().default(false),
  config: z.record(z.string(), z.unknown()),
});

export const documentLineSchema = z.object({
  itemId: z.string().min(1),
  description: z.string().optional().nullable(),
  quantity: z.number().int(),
  unitCostMinor: z.number().int().optional().nullable(),
  currency: z.string().default("BDT"),
  sourceWarehouseId: z.string().optional().nullable(),
  sourceLocationId: z.string().optional().nullable(),
  destinationWarehouseId: z.string().optional().nullable(),
  destinationLocationId: z.string().optional().nullable(),
  customData: z.record(z.string(), z.unknown()).optional(),
});

export const documentUpsertSchema = z.object({
  documentType: z.nativeEnum(InventoryDocumentType),
  number: z.string().min(1),
  documentDate: z.coerce.date().optional(),
  externalRef: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  sourceWarehouseId: z.string().optional().nullable(),
  sourceLocationId: z.string().optional().nullable(),
  destinationWarehouseId: z.string().optional().nullable(),
  destinationLocationId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  lines: z.array(documentLineSchema).min(1),
});

export const documentActionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "CANCEL", "POST"]),
  reason: z.string().optional().nullable(),
  idempotencyKey: z.string().optional(),
  allowNegativeOverride: z.boolean().default(false),
});

export const warehouseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const locationSchema = z.object({
  warehouseId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  path: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const reorderRuleSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  locationId: z.string().optional().nullable(),
  minQty: z.number().int().default(0),
  maxQty: z.number().int().default(0),
  reorderPoint: z.number().int().default(0),
  reorderQty: z.number().int().default(0),
  leadTimeDays: z.number().int().default(0),
  preferredVendorId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const attachmentCreateSchema = z.object({
  entityType: z.nativeEnum(InventoryAttachmentEntityType),
  entityId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export const attachmentFinalizeSchema = z.object({
  attachmentId: z.string().min(1),
  storageKey: z.string().min(1),
});

export const importJobSchema = z.object({
  entity: z.enum(["ITEMS", "OPENING_BALANCES", "REORDER_RULES"]),
  fileName: z.string().min(1),
  payload: z.string().optional(),
});

export const exportJobSchema = z.object({
  entity: z.enum(["ITEMS", "MOVEMENTS", "DOCUMENTS", "REORDER"]),
  format: z.enum(["CSV", "XLSX", "PDF"]).default("CSV"),
  fileName: z.string().min(1),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export const documentListQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(InventoryDocumentStatus).optional(),
  type: z.nativeEnum(InventoryDocumentType).optional(),
  q: z.string().optional(),
});

export const ledgerQuerySchema = paginationSchema.extend({
  itemId: z.string().optional(),
  warehouseId: z.string().optional(),
  documentId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
