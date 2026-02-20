import {
  AutomationActionType,
  AutomationTrigger,
  FormLayoutVersionStatus,
  Prisma,
  PropertyOverrideTarget,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  automationRuleActionSchema,
  automationRuleListQuerySchema,
  formLayoutActionSchema,
  formLayoutListQuerySchema,
  propertyOverrideRuleActionSchema,
  propertyOverrideRuleListQuerySchema,
  propertyOverrideRuleSchema,
} from "@/modules/platform/domain/schemas";
import { createAndExecuteAutomationRun } from "@/modules/platform/application/automation-runtime.service";

function resolveCompanyScope(ctx: PlatformRequestContext, companyId?: string): string {
  const effectiveCompanyId = companyId?.trim() || ctx.companyId;
  if (ctx.platformRole !== "SUPER_ADMIN" && effectiveCompanyId !== ctx.companyId) {
    throw new PlatformError("FORBIDDEN", "Cannot mutate metadata for another company");
  }
  return effectiveCompanyId;
}

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertCanMutateScopedRecord(ctx: PlatformRequestContext, companyId: string | null): void {
  if (ctx.platformRole === "SUPER_ADMIN") return;
  if (companyId && companyId === ctx.companyId) return;
  throw new PlatformError("FORBIDDEN", "Cannot mutate metadata for this scope");
}

function toInputJson(value: Prisma.JsonValue): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
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

  const [customFields, formLayouts, propertyOverrideRules, validationRules, printTemplates, automationRules] = await Promise.all([
    prisma.customField.findMany({ where, orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }] }),
    prisma.formLayout.findMany({ where, orderBy: [{ entityType: "asc" }, { version: "desc" }] }),
    prisma.propertyOverrideRule.findMany({ where, orderBy: [{ entityType: "asc" }, { priority: "desc" }] }),
    prisma.validationRule.findMany({ where, orderBy: [{ entityType: "asc" }, { name: "asc" }] }),
    prisma.printTemplate.findMany({ where, orderBy: [{ entityType: "asc" }, { isDefault: "desc" }, { name: "asc" }] }),
    prisma.automationRule.findMany({ where, orderBy: [{ entityType: "asc" }, { trigger: "asc" }, { name: "asc" }] }),
  ]);

  return {
    customFields,
    formLayouts,
    propertyOverrideRules,
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

export async function listFormLayouts(ctx: PlatformRequestContext, input: unknown) {
  const parsed = formLayoutListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid form layout query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.FormLayoutWhereInput = {
    tenantId: ctx.tenantId,
    OR: [{ companyId: ctx.companyId }, { companyId: null }],
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.includeInactive ? {} : { isActive: true }),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
            { entityType: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.formLayout.findMany({
      where,
      include: {
        versions: {
          ...(q.status ? { where: { status: q.status } } : {}),
          orderBy: [{ version: "desc" }],
          take: 20,
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.formLayout.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
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
    include: {
      versions: {
        orderBy: [{ version: "desc" }],
        take: 20,
      },
    },
  });
}

export async function applyFormLayoutAction(ctx: PlatformRequestContext, formLayoutId: string, input: unknown) {
  const parsed = formLayoutActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid form layout action", parsed.error.flatten());
  }

  const payload = parsed.data;

  const layout = await prisma.formLayout.findUnique({
    where: { id: formLayoutId },
    include: {
      versions: {
        orderBy: [{ version: "desc" }],
        take: 50,
      },
    },
  });

  if (!layout || layout.tenantId !== ctx.tenantId) {
    throw new PlatformError("NOT_FOUND", "Form layout not found");
  }
  assertCanMutateScopedRecord(ctx, layout.companyId);

  if (payload.action === "ROLLBACK") {
    if (!payload.version) {
      throw new PlatformError("VALIDATION_ERROR", "ROLLBACK requires version");
    }

    const version = layout.versions.find((row) => row.version === payload.version);
    if (!version) {
      throw new PlatformError("NOT_FOUND", "Requested form layout version not found");
    }

    return prisma.formLayout.update({
      where: { id: layout.id },
      data: {
        layout: toInputJson(version.layout),
        version: version.version,
        isActive: true,
        updatedBy: ctx.userId,
      },
      include: {
        versions: {
          orderBy: [{ version: "desc" }],
          take: 50,
        },
      },
    });
  }

  const nextVersion = (layout.versions[0]?.version ?? layout.version ?? 0) + 1;

  return prisma.$transaction(async (tx) => {
    if (payload.action === "PUBLISH") {
      await tx.formLayoutVersion.updateMany({
        where: {
          formLayoutId: layout.id,
          status: FormLayoutVersionStatus.PUBLISHED,
        },
        data: {
          status: FormLayoutVersionStatus.ARCHIVED,
          archivedAt: new Date(),
        },
      });

      await tx.formLayoutVersion.create({
        data: {
          formLayoutId: layout.id,
          version: nextVersion,
          status: FormLayoutVersionStatus.PUBLISHED,
          layout: toInputJson(layout.layout),
          publishedAt: new Date(),
          createdBy: ctx.userId,
        },
      });

      await tx.formLayout.update({
        where: { id: layout.id },
        data: {
          version: nextVersion,
          isActive: true,
          updatedBy: ctx.userId,
        },
      });
    } else {
      await tx.formLayoutVersion.create({
        data: {
          formLayoutId: layout.id,
          version: nextVersion,
          status: FormLayoutVersionStatus.ARCHIVED,
          layout: toInputJson(layout.layout),
          archivedAt: new Date(),
          createdBy: ctx.userId,
        },
      });

      await tx.formLayout.update({
        where: { id: layout.id },
        data: {
          version: nextVersion,
          isActive: false,
          updatedBy: ctx.userId,
        },
      });
    }

    return tx.formLayout.findUniqueOrThrow({
      where: { id: layout.id },
      include: {
        versions: {
          orderBy: [{ version: "desc" }],
          take: 50,
        },
      },
    });
  });
}

export async function listPropertyOverrideRules(ctx: PlatformRequestContext, input: unknown) {
  const parsed = propertyOverrideRuleListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid property override query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.PropertyOverrideRuleWhereInput = {
    tenantId: ctx.tenantId,
    OR: [{ companyId: ctx.companyId }, { companyId: null }],
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.target ? { target: q.target } : {}),
    ...(q.includeInactive ? {} : { isActive: true }),
    ...(q.q
      ? {
          OR: [
            { key: { contains: q.q, mode: "insensitive" } },
            { label: { contains: q.q, mode: "insensitive" } },
            { entityType: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.propertyOverrideRule.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.propertyOverrideRule.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createPropertyOverrideRule(ctx: PlatformRequestContext, input: unknown) {
  const parsed = propertyOverrideRuleSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid property override payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  const companyId = resolveCompanyScope(ctx, payload.companyId);

  return prisma.propertyOverrideRule.upsert({
    where: {
      tenantId_companyId_entityType_target_key: {
        tenantId: ctx.tenantId,
        companyId,
        entityType: payload.entityType,
        target: payload.target,
        key: payload.key,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      companyId,
      entityType: payload.entityType,
      target: payload.target,
      key: payload.key,
      label: payload.label ?? null,
      config: payload.config as never,
      priority: payload.priority,
      isActive: payload.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    update: {
      label: payload.label ?? null,
      config: payload.config as never,
      priority: payload.priority,
      isActive: payload.isActive ?? true,
      updatedBy: ctx.userId,
    },
  });
}

export async function applyPropertyOverrideRuleAction(
  ctx: PlatformRequestContext,
  ruleId: string,
  input: unknown,
) {
  const parsed = propertyOverrideRuleActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid property override action", parsed.error.flatten());
  }

  const payload = parsed.data;

  const row = await prisma.propertyOverrideRule.findUnique({ where: { id: ruleId } });
  if (!row || row.tenantId !== ctx.tenantId) {
    throw new PlatformError("NOT_FOUND", "Property override rule not found");
  }
  assertCanMutateScopedRecord(ctx, row.companyId);

  return prisma.propertyOverrideRule.update({
    where: { id: row.id },
    data: {
      isActive: payload.action === "ACTIVATE",
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

export async function listAutomationRules(ctx: PlatformRequestContext, input: unknown) {
  const parsed = automationRuleListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid automation rule query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.AutomationRuleWhereInput = {
    tenantId: ctx.tenantId,
    OR: [{ companyId: ctx.companyId }, { companyId: null }],
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.trigger ? { trigger: q.trigger } : {}),
    ...(q.actionType ? { actionType: q.actionType } : {}),
    ...(q.includeInactive ? {} : { isActive: true }),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
            { entityType: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.automationRule.findMany({
      where,
      include: {
        _count: {
          select: { runs: true },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.automationRule.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createAutomationRule(
  ctx: PlatformRequestContext,
  input: {
    companyId?: string;
    entityType: string;
    name: string;
    trigger: AutomationTrigger;
    condition?: Record<string, unknown>;
    actionType: AutomationActionType;
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
    include: {
      _count: {
        select: { runs: true },
      },
    },
  });
}

export async function applyAutomationRuleAction(
  ctx: PlatformRequestContext,
  ruleId: string,
  input: unknown,
) {
  const parsed = automationRuleActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid automation rule action", parsed.error.flatten());
  }

  const payload = parsed.data;

  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
  if (!rule || rule.tenantId !== ctx.tenantId) {
    throw new PlatformError("NOT_FOUND", "Automation rule not found");
  }
  assertCanMutateScopedRecord(ctx, rule.companyId);

  if (payload.action === "RUN") {
    return createAndExecuteAutomationRun(ctx, {
      automationRuleId: rule.id,
      entityType: rule.entityType,
      entityId: payload.entityId ?? null,
      trigger: payload.trigger ?? rule.trigger,
      idempotencyKey: payload.idempotencyKey ?? null,
      input: payload.input ?? {},
    });
  }

  return prisma.automationRule.update({
    where: { id: rule.id },
    data: {
      isActive: payload.action === "ACTIVATE",
      updatedBy: ctx.userId,
    },
    include: {
      _count: {
        select: { runs: true },
      },
    },
  });
}

export async function resolveCustomizationRuntime(
  ctx: PlatformRequestContext,
  input: { entityType: string },
) {
  const whereScoped = {
    tenantId: ctx.tenantId,
    entityType: input.entityType,
    OR: [{ companyId: ctx.companyId }, { companyId: null }],
  };

  const [customFields, formLayouts, propertyOverrideRules, validationRules, printTemplates, automationRules] =
    await Promise.all([
      prisma.customField.findMany({
        where: { ...whereScoped, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.formLayout.findMany({
        where: { ...whereScoped, isActive: true },
        include: {
          versions: {
            where: { status: FormLayoutVersionStatus.PUBLISHED },
            orderBy: [{ version: "desc" }],
            take: 1,
          },
        },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      }),
      prisma.propertyOverrideRule.findMany({
        where: { ...whereScoped, isActive: true },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      }),
      prisma.validationRule.findMany({
        where: { ...whereScoped, isActive: true },
        orderBy: [{ createdAt: "asc" }],
      }),
      prisma.printTemplate.findMany({
        where: { ...whereScoped, isActive: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      }),
      prisma.automationRule.findMany({
        where: { ...whereScoped, isActive: true },
        orderBy: [{ createdAt: "asc" }],
      }),
    ]);

  const activeLayout = formLayouts.find((row) => row.isDefault) ?? formLayouts[0] ?? null;

  return {
    entityType: input.entityType,
    customFields,
    activeFormLayout: activeLayout,
    formLayouts,
    propertyOverrideRules,
    validationRules,
    printTemplates,
    automationRules,
  };
}

export function getPropertyOverrideTargets(): readonly PropertyOverrideTarget[] {
  return [
    PropertyOverrideTarget.FIELD,
    PropertyOverrideTarget.FORM,
    PropertyOverrideTarget.LIST,
    PropertyOverrideTarget.ACTION,
  ] as const;
}
