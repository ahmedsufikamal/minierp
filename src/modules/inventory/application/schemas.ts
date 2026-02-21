import { z } from "zod";
import {
  InventoryAttachmentEntityType,
  InventoryCustomFieldEntityType,
  InventoryCustomFieldType,
  InventoryDocumentStatus,
  InventoryDocumentType,
  InventoryItemNamingBy,
  InventoryPresetScope,
  InventoryQiAction,
  InventoryReservationStatus,
  InventorySerialBatchPickBasis,
  InventoryValuationMethod,
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
  sku: z.string().trim().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  brandId: z.string().min(1),
  categoryId: z.string().optional().nullable(),
  subCategoryId: z.string().optional().nullable(),
  itemGroupId: z.string().optional().nullable(),
  uomId: z.string().optional().nullable(),
  uom: z.string().default("pcs"),
  unitCostMinor: z.number().int().nonnegative().default(0),
  priceCents: z.number().int().nonnegative().default(0),
  trackSerial: z.boolean().default(false),
  trackBatch: z.boolean().default(false),
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
  reservationId: z.string().optional().nullable(),
  batchCode: z.string().min(1).optional().nullable(),
  serialNumbers: z.array(z.string().min(1)).max(1000).optional(),
  customData: z.record(z.string(), z.unknown()).optional(),
});

export const documentUpsertSchema = z.object({
  documentType: z.nativeEnum(InventoryDocumentType),
  number: z.string().min(1).optional(),
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
  parentWarehouseId: z.string().min(1).optional().nullable(),
  address: z
    .object({
      line1: z.string().trim().min(1).optional(),
      line2: z.string().trim().optional(),
      city: z.string().trim().optional(),
      state: z.string().trim().optional(),
      postalCode: z.string().trim().optional(),
      country: z.string().trim().optional(),
    })
    .optional()
    .nullable(),
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

export const reservationCreateSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  locationId: z.string().optional().nullable(),
  quantity: z.number().int().positive(),
  referenceType: z.string().optional().nullable(),
  referenceId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const reservationListQuerySchema = paginationSchema.extend({
  itemId: z.string().optional(),
  warehouseId: z.string().optional(),
  status: z.nativeEnum(InventoryReservationStatus).optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
});

export const reservationReleaseSchema = z.object({
  reason: z.string().optional().nullable(),
  cancel: z.boolean().default(false),
});

export const reconciliationLineSchema = z.object({
  itemId: z.string().min(1),
  countedQty: z.number().int(),
  unitCostMinor: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().default("BDT"),
  batchCode: z.string().min(1).optional().nullable(),
  serialNumbers: z.array(z.string().min(1)).max(1000).optional(),
});

export const reconciliationPreviewSchema = z.object({
  warehouseId: z.string().min(1),
  locationId: z.string().optional().nullable(),
  lines: z.array(reconciliationLineSchema).min(1),
});

export const reconciliationApplySchema = z.object({
  number: z.string().min(1).optional(),
  documentDate: z.coerce.date().optional(),
  warehouseId: z.string().min(1),
  locationId: z.string().optional().nullable(),
  externalRef: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  lines: z.array(reconciliationLineSchema).min(1),
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

export const inventoryCompanySettingsSchema = z.object({
  defaultWarehouseId: z.string().trim().min(1).optional().nullable(),
  documentSeriesCode: z.string().trim().min(1).max(80).optional().nullable(),
  defaultUom: z.string().trim().min(1).max(32).default("pcs"),
  valuationMethod: z.enum(["MOVING_AVERAGE", "FIFO"]).default("MOVING_AVERAGE"),
  preventNegativeStock: z.boolean().default(true),
  allowNegativeOverride: z.boolean().default(false),
  trackByLocation: z.boolean().default(false),
  baseCurrency: z.string().trim().min(3).max(3).default("BDT"),
});

const percentageSettingSchema = z.coerce.number().min(0).max(100);
const freezeDaysSchema = z.coerce.number().int().min(0);

export const stockSettingsSchema = z.object({
  item_naming_by: z.nativeEnum(InventoryItemNamingBy).default(InventoryItemNamingBy.ITEM_CODE),
  default_warehouse_id: z.string().trim().min(1).optional().nullable(),
  default_stock_uom_id: z.string().trim().min(1).optional().nullable(),
  default_valuation_method: z.nativeEnum(InventoryValuationMethod).default(InventoryValuationMethod.FIFO),
  auto_insert_item_price_if_missing: z.boolean().default(true),
  update_existing_price_list_rate: z.boolean().default(false),
  allow_edit_stock_uom_qty_sales_docs: z.boolean().default(true),
  allow_edit_stock_uom_qty_purchase_docs: z.boolean().default(true),
  over_delivery_receipt_allowance_pct: percentageSettingSchema.default(0),
  over_transfer_allowance_pct: percentageSettingSchema.default(0),
  over_picking_allowance_pct: percentageSettingSchema.default(0),
  allow_negative_stock: z.boolean().default(false),
  show_barcode_field_in_stock_transactions: z.boolean().default(true),
  convert_item_description_to_clean_html: z.boolean().default(true),
  allow_internal_transfers_at_arms_length_price: z.boolean().default(false),
  qi_action_if_not_submitted: z.nativeEnum(InventoryQiAction).default(InventoryQiAction.STOP),
  qi_action_if_rejected: z.nativeEnum(InventoryQiAction).default(InventoryQiAction.STOP),
  enable_stock_reservation: z.boolean().default(true),
  allow_partial_reservation: z.boolean().default(false),
  auto_reserve_stock_for_sales_order_on_purchase: z.boolean().default(false),
  auto_reserve_serial_and_batch_nos: z.boolean().default(false),
  auto_create_serial_and_batch_bundle_for_outward: z.boolean().default(true),
  pick_serial_batch_based_on: z.nativeEnum(InventorySerialBatchPickBasis).default(InventorySerialBatchPickBasis.FIFO),
  disable_serial_no_and_batch_selector: z.boolean().default(false),
  have_default_naming_series_for_batch_id: z.boolean().default(false),
  use_serial_batch_fields: z.boolean().default(false),
  do_not_update_serial_batch_on_creation_of_auto_bundle: z.boolean().default(false),
  allow_existing_serial_no_to_be_received_again: z.boolean().default(true),
  set_bundle_naming_based_on_naming_series: z.boolean().default(false),
  raise_material_request_when_stock_reaches_reorder_level: z.boolean().default(true),
  notify_by_email_on_creation_of_automatic_material_request: z.boolean().default(false),
  allow_material_transfer_from_delivery_note_to_sales_invoice: z.boolean().default(false),
  allow_material_transfer_from_purchase_receipt_to_purchase_invoice: z.boolean().default(false),
  freeze_stocks_older_than_days: freezeDaysSchema.default(60),
});

export const stockSettingsPatchSchema = stockSettingsSchema
  .partial()
  .extend({
    version: z.coerce.number().int().positive().optional(),
  });

export const stockSettingsPutSchema = stockSettingsSchema.extend({
  version: z.coerce.number().int().positive().optional(),
});
