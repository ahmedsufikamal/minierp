import { z } from "zod";
import {
  AutomationActionType,
  AutomationRuleRunStatus,
  AutomationTrigger,
  CustomFieldDataType,
  FormLayoutVersionStatus,
  NumberSeriesResetPolicy,
  PlatformPermissionEffect,
  PlatformScopeLevel,
  PlatformWorkflowDefinitionStatus,
  PropertyOverrideTarget,
  ReportScheduleFrequency,
  ReportSourceType,
} from "@prisma/client";
import { companyCodeFormatKeys } from "@/modules/platform/domain/company-numbering";

export const tenantCreateSchema = z.object({
  key: z.string().trim().min(2).max(64).regex(/^[a-z0-9-]+$/, "Tenant key must be lowercase letters, numbers, or hyphens"),
  name: z.string().trim().min(2).max(120),
  plan: z.string().trim().max(64).optional(),
  primaryDomain: z.string().trim().toLowerCase().optional(),
  company: z
    .object({
      name: z.string().trim().min(2).max(120),
      slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
    })
    .optional(),
});

export const tenantDomainSchema = z.object({
  domain: z.string().trim().toLowerCase().min(3).max(253),
  isPrimary: z.boolean().optional(),
});

export const roleProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  isDefault: z.boolean().optional(),
});

export const permissionRuleSchema = z.object({
  roleProfileId: z.string().trim().min(1),
  module: z.string().trim().min(1).max(80),
  resource: z.string().trim().min(1).max(120),
  action: z.string().trim().min(1).max(80),
  effect: z.nativeEnum(PlatformPermissionEffect).default(PlatformPermissionEffect.ALLOW),
  scopeLevel: z.nativeEnum(PlatformScopeLevel).default(PlatformScopeLevel.COMPANY),
  condition: z.record(z.string(), z.any()).optional(),
});

export const rowScopeRuleSchema = z.object({
  roleProfileId: z.string().trim().min(1),
  resource: z.string().trim().min(1).max(120),
  scopeLevel: z.nativeEnum(PlatformScopeLevel),
  selector: z.record(z.string(), z.any()),
});

export const workflowStateSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  isInitial: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const workflowTransitionSchema = z.object({
  actionKey: z.string().trim().min(1).max(80),
  fromState: z.string().trim().min(1).max(80),
  toState: z.string().trim().min(1).max(80),
  minApprovals: z.number().int().min(1).default(1),
  requiredPermissions: z.array(z.string().trim().min(1)).default([]),
  conditions: z.record(z.string(), z.any()).optional(),
});

export const workflowDefinitionSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2).max(120),
  status: z.nativeEnum(PlatformWorkflowDefinitionStatus).default(PlatformWorkflowDefinitionStatus.ACTIVE),
  initialState: z.string().trim().min(1).max(80),
  terminalStates: z.array(z.string().trim().min(1).max(80)).default([]),
  states: z.array(workflowStateSchema).min(1),
  transitions: z.array(workflowTransitionSchema).min(1),
  config: z.record(z.string(), z.any()).default({}),
});

export const workflowStartSchema = z.object({
  entityType: z.string().trim().min(1).max(120),
  entityId: z.string().trim().min(1).max(120),
  companyId: z.string().trim().min(1).optional(),
  context: z.record(z.string(), z.any()).optional(),
});

export const workflowActionSchema = z.object({
  instanceId: z.string().trim().min(1),
  actionKey: z.string().trim().min(1),
  comment: z.string().trim().max(500).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const auditQuerySchema = z.object({
  entityType: z.string().trim().optional(),
  entityId: z.string().trim().optional(),
  source: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const immutableVerifySchema = z.object({
  stream: z.string().trim().optional(),
});

export const numberSeriesSchema = z.object({
  companyId: z.string().trim().optional(),
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  pattern: z.string().trim().min(1).max(120),
  resetPolicy: z.nativeEnum(NumberSeriesResetPolicy).default(NumberSeriesResetPolicy.NEVER),
  startAt: z.number().int().min(1).default(1),
  padding: z.number().int().min(1).max(12).default(4),
  metadata: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
});

export const numberSeriesAllocateSchema = z.object({
  key: z.string().trim().min(1).max(80),
  companyId: z.string().trim().optional(),
  fiscalYear: z.string().trim().max(20).optional(),
  date: z.coerce.date().optional(),
});

export const companyCodeFormatKeySchema = z.enum(companyCodeFormatKeys);

export const companyNumberingPatchSchema = z.object({
  formats: z
    .array(
      z.object({
        key: companyCodeFormatKeySchema,
        pattern: z.string().trim().min(1).max(120).optional(),
        resetPolicy: z.nativeEnum(NumberSeriesResetPolicy).optional(),
        startAt: z.number().int().min(1).optional(),
        padding: z.number().int().min(1).max(12).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .min(1)
    .optional(),
  action: z.enum(["SAVE", "RESET"]).optional(),
  settings: z.unknown().optional(),
}).refine((value) => value.action === "RESET" || Boolean(value.formats?.length) || value.settings, {
  message: "Provide formats, settings, or a reset action.",
});

export const companyNumberingPreviewSchema = z.object({
  key: companyCodeFormatKeySchema,
  pattern: z.string().trim().min(1).max(120).optional(),
  resetPolicy: z.nativeEnum(NumberSeriesResetPolicy).optional(),
  padding: z.number().int().min(1).max(12).optional(),
  sequence: z.number().int().min(1).optional(),
  fiscalYear: z.string().trim().max(20).optional(),
  date: z.coerce.date().optional(),
  definition: z.unknown().optional(),
  variantId: z.string().trim().min(1).max(120).optional(),
  sample: z.record(z.string(), z.unknown()).optional(),
});

export const reportDefinitionSchema = z.object({
  companyId: z.string().trim().optional(),
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  sourceType: z.nativeEnum(ReportSourceType).default(ReportSourceType.ADAPTER),
  sourceRef: z.string().trim().min(1).max(120),
  schema: z.record(z.string(), z.any()).optional(),
  defaultFilters: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
});

export const reportViewSchema = z.object({
  reportDefinitionId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  isDefault: z.boolean().optional(),
  filters: z.record(z.string(), z.any()).optional(),
  columns: z.array(z.string()).optional(),
  sort: z.record(z.string(), z.any()).optional(),
  visibility: z.record(z.string(), z.any()).optional(),
});

export const reportScheduleSchema = z.object({
  reportDefinitionId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  frequency: z.nativeEnum(ReportScheduleFrequency),
  cronExpr: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(80).optional(),
  recipients: z.array(z.string().email()).min(1),
  filters: z.record(z.string(), z.any()).optional(),
  outputFormat: z.string().trim().min(2).max(20).default("CSV"),
  isActive: z.boolean().optional(),
});

export const reportRunSchema = z.object({
  reportDefinitionId: z.string().trim().min(1),
  filters: z.record(z.string(), z.any()).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export const customFieldSchema = z.object({
  companyId: z.string().trim().optional(),
  entityType: z.string().trim().min(1).max(120),
  fieldKey: z.string().trim().min(1).max(120).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().trim().min(1).max(120),
  dataType: z.nativeEnum(CustomFieldDataType),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  showInList: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  options: z.record(z.string(), z.any()).optional(),
  defaultValue: z.any().optional(),
  permissions: z.record(z.string(), z.any()).optional(),
  validation: z.record(z.string(), z.any()).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const formLayoutSchema = z.object({
  companyId: z.string().trim().optional(),
  entityType: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  version: z.number().int().min(1).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  layout: z.record(z.string(), z.any()),
});

export const validationRuleSchema = z.object({
  companyId: z.string().trim().optional(),
  entityType: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  trigger: z.string().trim().min(1).max(40),
  ruleType: z.string().trim().min(1).max(40),
  expression: z.string().trim().max(500).optional(),
  config: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
});

export const printTemplateSchema = z.object({
  companyId: z.string().trim().optional(),
  entityType: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  templateHtml: z.string().trim().min(1),
  css: z.string().trim().optional(),
  variablesSchema: z.record(z.string(), z.any()).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const automationRuleSchema = z.object({
  companyId: z.string().trim().optional(),
  entityType: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  trigger: z.nativeEnum(AutomationTrigger),
  condition: z.record(z.string(), z.any()).optional(),
  actionType: z.nativeEnum(AutomationActionType),
  actionConfig: z.record(z.string(), z.any()),
  runAsRole: z.string().trim().max(80).optional(),
  isActive: z.boolean().optional(),
});

const customizationListBaseSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  q: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  includeInactive: z.coerce.boolean().default(false),
});

export const formLayoutListQuerySchema = customizationListBaseSchema.extend({
  status: z.nativeEnum(FormLayoutVersionStatus).optional(),
});

export const formLayoutActionSchema = z.object({
  action: z.enum(["PUBLISH", "ARCHIVE", "ROLLBACK"]),
  version: z.coerce.number().int().min(1).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const propertyOverrideRuleSchema = z.object({
  companyId: z.string().trim().optional(),
  entityType: z.string().trim().min(1).max(120),
  target: z.nativeEnum(PropertyOverrideTarget),
  key: z.string().trim().min(1).max(120),
  label: z.string().trim().max(160).optional().nullable(),
  config: z.record(z.string(), z.any()),
  priority: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().optional(),
});

export const propertyOverrideRuleListQuerySchema = customizationListBaseSchema.extend({
  target: z.nativeEnum(PropertyOverrideTarget).optional(),
});

export const propertyOverrideRuleActionSchema = z.object({
  action: z.enum(["ACTIVATE", "DEACTIVATE"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const automationRuleListQuerySchema = customizationListBaseSchema.extend({
  trigger: z.nativeEnum(AutomationTrigger).optional(),
  actionType: z.nativeEnum(AutomationActionType).optional(),
});

export const automationRuleActionSchema = z.object({
  action: z.enum(["ACTIVATE", "DEACTIVATE", "RUN"]),
  trigger: z.nativeEnum(AutomationTrigger).optional(),
  entityId: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().max(160).optional().nullable(),
  input: z.record(z.string(), z.any()).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const automationRunListQuerySchema = customizationListBaseSchema.extend({
  status: z.nativeEnum(AutomationRuleRunStatus).optional(),
  automationRuleId: z.string().trim().optional(),
  trigger: z.nativeEnum(AutomationTrigger).optional(),
  entityId: z.string().trim().optional(),
});

export const automationRunCreateSchema = z.object({
  automationRuleId: z.string().trim().optional().nullable(),
  entityType: z.string().trim().min(1).max(120),
  entityId: z.string().trim().optional().nullable(),
  trigger: z.nativeEnum(AutomationTrigger),
  idempotencyKey: z.string().trim().max(160).optional().nullable(),
  input: z.record(z.string(), z.any()).optional(),
});

export const customizationRuntimeQuerySchema = z.object({
  entityType: z.string().trim().min(1).max(120),
});

export const setupMasterListQuerySchema = z.object({
  q: z.string().trim().optional(),
  includeInactive: z.coerce.boolean().default(false),
});

const setupMasterBaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  isActive: z.boolean().optional(),
});

export const setupItemGroupSchema = setupMasterBaseSchema.extend({
  parentId: z.string().trim().optional().nullable(),
  isGroup: z.boolean().optional(),
});

export const setupUomSchema = setupMasterBaseSchema.extend({
  symbol: z.string().trim().max(20).optional().nullable(),
  mustBeWholeNumber: z.boolean().optional(),
});

export const setupTerritorySchema = setupMasterBaseSchema.extend({
  parentId: z.string().trim().optional().nullable(),
});

export const setupCustomerGroupSchema = setupMasterBaseSchema.extend({
  parentId: z.string().trim().optional().nullable(),
});

export const setupSupplierGroupSchema = setupMasterBaseSchema.extend({
  parentId: z.string().trim().optional().nullable(),
});
