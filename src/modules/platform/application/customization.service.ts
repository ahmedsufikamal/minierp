import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

function resolveCompanyScope(ctx: PlatformRequestContext, companyId?: string): string {
  const effectiveCompanyId = companyId?.trim() || ctx.companyId;
  if (ctx.platformRole !== "SUPER_ADMIN" && effectiveCompanyId !== ctx.companyId) {
    throw new PlatformError("FORBIDDEN", "Cannot mutate metadata for another company");
  }
  return effectiveCompanyId;
}

export async function listCustomizationMetadata(
  ctx: PlatformRequestContext,
  input: { entityType?: string },
) {
  const where = {
    tenantId: ctx.tenantId,
    OR: [{ companyId: ctx.companyId }, { companyId: null }],
    ...(input.entityType ? { entityType: input.entityType } : {}),
  };

  const [customFields, formLayouts, validationRules, printTemplates, automationRules] = await Promise.all([
    prisma.customField.findMany({ where, orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }] }),
    prisma.formLayout.findMany({ where, orderBy: [{ entityType: "asc" }, { version: "desc" }] }),
    prisma.validationRule.findMany({ where, orderBy: [{ entityType: "asc" }, { name: "asc" }] }),
    prisma.printTemplate.findMany({ where, orderBy: [{ entityType: "asc" }, { isDefault: "desc" }, { name: "asc" }] }),
    prisma.automationRule.findMany({ where, orderBy: [{ entityType: "asc" }, { trigger: "asc" }, { name: "asc" }] }),
  ]);

  return {
    customFields,
    formLayouts,
    validationRules,
    printTemplates,
    automationRules,
  };
}

export async function upsertCustomField(
  ctx: PlatformRequestContext,
  input: {
    companyId?: string;
    entityType: string;
    fieldKey: string;
    label: string;
    dataType: "TEXT" | "NUMBER" | "DATE" | "DATETIME" | "SELECT" | "LINK" | "TABLE" | "BOOLEAN" | "CURRENCY" | "JSON";
    required?: boolean;
    unique?: boolean;
    showInList?: boolean;
    readOnly?: boolean;
    isHidden?: boolean;
    options?: Record<string, unknown>;
    defaultValue?: unknown;
    permissions?: Record<string, unknown>;
    validation?: Record<string, unknown>;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  const companyId = resolveCompanyScope(ctx, input.companyId);

  return prisma.customField.upsert({
    where: {
      tenantId_companyId_entityType_fieldKey: {
        tenantId: ctx.tenantId,
        companyId,
        entityType: input.entityType,
        fieldKey: input.fieldKey,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      companyId,
      entityType: input.entityType,
      fieldKey: input.fieldKey,
      label: input.label,
      dataType: input.dataType,
      required: input.required ?? false,
      unique: input.unique ?? false,
      showInList: input.showInList ?? false,
      readOnly: input.readOnly ?? false,
      isHidden: input.isHidden ?? false,
      options: (input.options ?? null) as never,
      defaultValue: (input.defaultValue ?? null) as never,
      permissions: (input.permissions ?? null) as never,
      validation: (input.validation ?? null) as never,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    update: {
      label: input.label,
      dataType: input.dataType,
      required: input.required ?? false,
      unique: input.unique ?? false,
      showInList: input.showInList ?? false,
      readOnly: input.readOnly ?? false,
      isHidden: input.isHidden ?? false,
      options: (input.options ?? null) as never,
      defaultValue: (input.defaultValue ?? null) as never,
      permissions: (input.permissions ?? null) as never,
      validation: (input.validation ?? null) as never,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      updatedBy: ctx.userId,
    },
  });
}

export async function createFormLayout(
  ctx: PlatformRequestContext,
  input: {
    companyId?: string;
    entityType: string;
    name: string;
    version?: number;
    isDefault?: boolean;
    isActive?: boolean;
    layout: Record<string, unknown>;
  },
) {
  const companyId = resolveCompanyScope(ctx, input.companyId);

  if (input.isDefault) {
    await prisma.formLayout.updateMany({
      where: {
        tenantId: ctx.tenantId,
        companyId,
        entityType: input.entityType,
        isDefault: true,
      },
      data: { isDefault: false, updatedBy: ctx.userId },
    });
  }

  return prisma.formLayout.create({
    data: {
      tenantId: ctx.tenantId,
      companyId,
      entityType: input.entityType,
      name: input.name,
      version: input.version ?? 1,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      layout: input.layout as never,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });
}

export async function createValidationRule(
  ctx: PlatformRequestContext,
  input: {
    companyId?: string;
    entityType: string;
    name: string;
    trigger: string;
    ruleType: string;
    expression?: string;
    config?: Record<string, unknown>;
    isActive?: boolean;
  },
) {
  const companyId = resolveCompanyScope(ctx, input.companyId);

  return prisma.validationRule.create({
    data: {
      tenantId: ctx.tenantId,
      companyId,
      entityType: input.entityType,
      name: input.name,
      trigger: input.trigger,
      ruleType: input.ruleType,
      expression: input.expression ?? null,
      config: (input.config ?? null) as never,
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });
}

export async function upsertPrintTemplate(
  ctx: PlatformRequestContext,
  input: {
    companyId?: string;
    entityType: string;
    name: string;
    templateHtml: string;
    css?: string;
    variablesSchema?: Record<string, unknown>;
    isDefault?: boolean;
    isActive?: boolean;
  },
) {
  const companyId = resolveCompanyScope(ctx, input.companyId);

  if (input.isDefault) {
    await prisma.printTemplate.updateMany({
      where: {
        tenantId: ctx.tenantId,
        companyId,
        entityType: input.entityType,
        isDefault: true,
      },
      data: { isDefault: false, updatedBy: ctx.userId },
    });
  }

  return prisma.printTemplate.upsert({
    where: {
      tenantId_companyId_entityType_name: {
        tenantId: ctx.tenantId,
        companyId,
        entityType: input.entityType,
        name: input.name,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      companyId,
      entityType: input.entityType,
      name: input.name,
      templateHtml: input.templateHtml,
      css: input.css ?? null,
      variablesSchema: (input.variablesSchema ?? null) as never,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    update: {
      templateHtml: input.templateHtml,
      css: input.css ?? null,
      variablesSchema: (input.variablesSchema ?? null) as never,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      updatedBy: ctx.userId,
    },
  });
}

export async function createAutomationRule(
  ctx: PlatformRequestContext,
  input: {
    companyId?: string;
    entityType: string;
    name: string;
    trigger: "ON_CREATE" | "ON_SUBMIT" | "ON_STATUS_CHANGE";
    condition?: Record<string, unknown>;
    actionType: "SET_FIELD" | "CREATE_TASK" | "SEND_NOTIFICATION" | "CALL_WEBHOOK";
    actionConfig: Record<string, unknown>;
    runAsRole?: string;
    isActive?: boolean;
  },
) {
  const companyId = resolveCompanyScope(ctx, input.companyId);

  return prisma.automationRule.create({
    data: {
      tenantId: ctx.tenantId,
      companyId,
      entityType: input.entityType,
      name: input.name,
      trigger: input.trigger,
      condition: (input.condition ?? null) as never,
      actionType: input.actionType,
      actionConfig: input.actionConfig as never,
      runAsRole: input.runAsRole ?? null,
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });
}
