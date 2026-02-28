import { CustomFieldDataType } from "@prisma/client";
import { z } from "zod";

const jsonRecord = z.record(z.string(), z.any());

export const pagingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  page: z.coerce.number().int().min(1).default(1),
});

export const metaModelCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(160),
  isCore: z.boolean().optional(),
  draftConfig: jsonRecord.optional(),
});

export const metaModelUpdateSchema = z.object({
  label: z.string().trim().min(1).max(160).optional(),
  draftConfig: jsonRecord.optional(),
  action: z.enum(["SAVE_DRAFT", "PUBLISH"]).optional(),
});

export const metaCompiledQuerySchema = z.object({
  version: z.coerce.number().int().min(1).optional(),
});

export const metaCustomFieldUpsertSchema = z.object({
  modelName: z.string().trim().min(1).max(120),
  fieldKey: z.string().trim().min(1).max(120).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().trim().min(1).max(160),
  dataType: z.nativeEnum(CustomFieldDataType),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  baseField: z.string().trim().max(120).optional().nullable(),
  defaultValue: z.any().optional(),
  options: jsonRecord.optional(),
  ui: jsonRecord.optional(),
  validation: z.any().optional(),
  isActive: z.boolean().optional(),
});

export const metaWorkflowStateSchema = z.object({
  stateKey: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  isInitial: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  config: jsonRecord.optional(),
});

export const metaWorkflowTransitionSchema = z.object({
  actionKey: z.string().trim().min(1).max(80),
  fromState: z.string().trim().min(1).max(80),
  toState: z.string().trim().min(1).max(80),
  requiredPermissions: z.array(z.string().trim().min(1)).default([]),
  conditions: z.any().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const metaWorkflowDraftSchema = z.object({
  notes: z.string().trim().max(500).optional().nullable(),
  states: z.array(metaWorkflowStateSchema).min(1),
  transitions: z.array(metaWorkflowTransitionSchema).min(1),
});

export const metaPrintTemplateUpsertSchema = z.object({
  modelName: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  templateType: z.string().trim().min(2).max(30).default("HTML"),
  draftTemplate: z.string().trim().min(1),
  draftCss: z.string().optional().nullable(),
  variablesSchema: jsonRecord.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const metaExportQuerySchema = z.object({
  model: z.string().trim().optional(),
});

export const metaImportSchema = z.object({
  models: z.array(
    z.object({
      model: metaModelCreateSchema.extend({
        publishedVersion: z.coerce.number().int().min(0).optional(),
      }),
      fields: z.array(metaCustomFieldUpsertSchema).default([]),
      workflows: z
        .array(
          z.object({
            version: z.coerce.number().int().min(1).optional(),
            isPublished: z.boolean().optional(),
            notes: z.string().optional().nullable(),
            states: z.array(metaWorkflowStateSchema).default([]),
            transitions: z.array(metaWorkflowTransitionSchema).default([]),
          }),
        )
        .default([]),
      printTemplates: z.array(metaPrintTemplateUpsertSchema).default([]),
    }),
  ),
});

export const metaAuditQuerySchema = z.object({
  model: z.string().trim().optional(),
  since: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const metaRenderTemplateQuerySchema = z.object({
  recordId: z.string().trim().min(1),
});

export const masterItemsQuerySchema = z.object({
  query: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().optional(),
});

export const masterItemUpsertSchema = z.object({
  sku: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  brandId: z.string().trim().min(1),
  categoryId: z.string().trim().optional().nullable(),
  subCategoryId: z.string().trim().optional().nullable(),
  itemGroupId: z.string().trim().optional().nullable(),
  uomId: z.string().trim().optional().nullable(),
  uom: z.string().trim().max(30).optional(),
  barcode: z.string().trim().max(120).optional().nullable(),
  itemType: z.string().trim().max(80).optional().nullable(),
  itemStatus: z.string().trim().max(80).optional().nullable(),
  unitCostMinor: z.coerce.number().int().optional(),
  priceCents: z.coerce.number().int().optional(),
  customData: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
});

export const masterPartiesQuerySchema = z.object({
  query: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().optional(),
});

const partyAddressSchema = z.object({
  id: z.string().trim().optional(),
  addressType: z.string().trim().max(40).default("BILLING"),
  line1: z.string().trim().min(1).max(240),
  line2: z.string().trim().max(240).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(120).optional().nullable(),
  postalCode: z.string().trim().max(40).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  isPrimary: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
});

const partyContactSchema = z.object({
  id: z.string().trim().optional(),
  firstName: z.string().trim().max(120).optional().nullable(),
  lastName: z.string().trim().max(120).optional().nullable(),
  fullName: z.string().trim().max(240).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  designation: z.string().trim().max(120).optional().nullable(),
  isPrimary: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
});

export const masterPartyUpsertSchema = z.object({
  partyCode: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(240),
  displayName: z.string().trim().max(240).optional().nullable(),
  partyType: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
  status: z.string().trim().max(40).default("ACTIVE"),
  taxId: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  website: z.string().trim().url().optional().nullable(),
  tags: z.array(z.string().trim()).optional(),
  customData: z.record(z.string(), z.any()).optional(),
  addresses: z.array(partyAddressSchema).default([]),
  contacts: z.array(partyContactSchema).default([]),
});

export const masterPartyMergeSchema = z.object({
  targetPartyId: z.string().trim().min(1),
  note: z.string().trim().max(500).optional().nullable(),
});

export const masterPriceListItemSchema = z.object({
  itemCode: z.string().trim().min(1).max(120),
  productId: z.string().trim().optional().nullable(),
  uomId: z.string().trim().optional().nullable(),
  minQty: z.coerce.number().optional().nullable(),
  rate: z.coerce.number().nonnegative(),
  currency: z.string().trim().length(3),
  isActive: z.boolean().optional(),
  metadata: jsonRecord.optional(),
});

export const masterPriceListUpsertSchema = z.object({
  key: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200),
  currency: z.string().trim().length(3),
  status: z.string().trim().max(40).default("DRAFT"),
  validFrom: z.coerce.date().optional().nullable(),
  validTo: z.coerce.date().optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  items: z.array(masterPriceListItemSchema).default([]),
});
