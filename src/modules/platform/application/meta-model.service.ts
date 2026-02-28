import { CustomFieldDataType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendAuditEvent } from "@/modules/platform/application/audit-ledger.service";
import { compileMetaPayload, validateCustomDataWithCompiledSchema } from "@/modules/platform/application/meta-compile.service";
import {
  getCompiledMetaCache,
  invalidateCompiledMetaCache,
  setCompiledMetaCache,
} from "@/modules/platform/application/meta-cache.service";
import {
  assertPermissionCeiling,
  piiMasked,
  renderMustacheStrict,
  stripUnsafeHtml,
  validateJsonLogicExpression,
} from "@/modules/platform/application/meta-security.service";
import { PlatformError } from "@/modules/platform/domain/errors";
import { platformPermissions, type PlatformRequestContext } from "@/modules/platform/domain/types";

type WorkflowDraftInput = {
  notes?: string | null;
  states: Array<{
    stateKey: string;
    label: string;
    isInitial?: boolean;
    isTerminal?: boolean;
    sortOrder?: number;
    config?: Record<string, unknown>;
  }>;
  transitions: Array<{
    actionKey: string;
    fromState: string;
    toState: string;
    requiredPermissions?: string[];
    conditions?: unknown;
    sortOrder?: number;
  }>;
};

function hasDraftReadPermission(ctx: PlatformRequestContext): boolean {
  return ctx.platformRole === "SUPER_ADMIN" || ctx.permissions.includes(platformPermissions.metaReadDrafts);
}

function assertCanPublish(ctx: PlatformRequestContext): void {
  if (ctx.platformRole === "SUPER_ADMIN") return;
  if (!ctx.permissions.includes(platformPermissions.metaPublish)) {
    throw new PlatformError("FORBIDDEN", `Missing permission: ${platformPermissions.metaPublish}`);
  }
}

function normalizeModelName(name: string): string {
  return name.trim();
}

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function diff(before: unknown, after: unknown): Record<string, unknown> {
  return {
    before,
    after,
  };
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

async function appendMetaChange(
  ctx: PlatformRequestContext,
  input: {
    modelName: string;
    entityType: string;
    entityId?: string;
    action: string;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await prisma.metaChangeLog.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      modelName: input.modelName,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      before: (input.before ?? null) as Prisma.InputJsonValue,
      after: (input.after ?? null) as Prisma.InputJsonValue,
      diff: diff(input.before ?? null, input.after ?? null) as Prisma.InputJsonValue,
      actorUserId: ctx.userId,
      actorEmail: null,
      sourceIp: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      requestId: ctx.requestId,
    },
  });
}

async function getModelByNameOrThrow(ctx: PlatformRequestContext, modelName: string) {
  const row = await prisma.metaModel.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      name: normalizeModelName(modelName),
    },
  });

  if (!row) {
    throw new PlatformError("NOT_FOUND", `Meta model '${modelName}' not found`);
  }

  return row;
}

const coreMetaSeed: Array<{
  name: string;
  label: string;
  fields: Array<{
    fieldKey: string;
    label: string;
    dataType: CustomFieldDataType;
    required?: boolean;
    unique?: boolean;
    baseField?: string;
    sortOrder?: number;
  }>;
}> = [
  {
    name: "Party",
    label: "Business Partner",
    fields: [
      { fieldKey: "partyCode", label: "Party Code", dataType: "TEXT", required: true, unique: true, baseField: "partyCode" },
      { fieldKey: "name", label: "Name", dataType: "TEXT", required: true, baseField: "name" },
      { fieldKey: "partyType", label: "Party Type", dataType: "SELECT", required: true, baseField: "partyType" },
      { fieldKey: "status", label: "Status", dataType: "SELECT", required: true, baseField: "status" },
      { fieldKey: "taxId", label: "Tax ID", dataType: "TEXT", baseField: "taxId" },
      { fieldKey: "email", label: "Email", dataType: "TEXT", baseField: "email" },
      { fieldKey: "phone", label: "Phone", dataType: "TEXT", baseField: "phone" },
    ],
  },
  {
    name: "Item",
    label: "Item",
    fields: [
      { fieldKey: "sku", label: "SKU", dataType: "TEXT", required: true, unique: true, baseField: "sku" },
      { fieldKey: "name", label: "Name", dataType: "TEXT", required: true, baseField: "name" },
      { fieldKey: "barcode", label: "Barcode", dataType: "TEXT", baseField: "barcode" },
      { fieldKey: "itemType", label: "Item Type", dataType: "SELECT", baseField: "itemType" },
      { fieldKey: "itemStatus", label: "Item Status", dataType: "SELECT", baseField: "itemStatus" },
    ],
  },
  {
    name: "UoM",
    label: "Unit of Measure",
    fields: [
      { fieldKey: "name", label: "Name", dataType: "TEXT", required: true, unique: true, baseField: "name" },
      { fieldKey: "symbol", label: "Symbol", dataType: "TEXT", baseField: "symbol" },
    ],
  },
  {
    name: "PriceList",
    label: "Price List",
    fields: [
      { fieldKey: "key", label: "Key", dataType: "TEXT", required: true, unique: true, baseField: "key" },
      { fieldKey: "name", label: "Name", dataType: "TEXT", required: true, baseField: "name" },
      { fieldKey: "currency", label: "Currency", dataType: "TEXT", required: true, baseField: "currency" },
      { fieldKey: "status", label: "Status", dataType: "SELECT", required: true, baseField: "status" },
    ],
  },
  {
    name: "Currency",
    label: "Currency",
    fields: [
      { fieldKey: "code", label: "Code", dataType: "TEXT", required: true, unique: true, baseField: "code" },
      { fieldKey: "name", label: "Name", dataType: "TEXT", required: true, baseField: "name" },
      { fieldKey: "precision", label: "Precision", dataType: "NUMBER", baseField: "precision" },
    ],
  },
  {
    name: "TaxCode",
    label: "Tax Code",
    fields: [
      { fieldKey: "code", label: "Code", dataType: "TEXT", required: true, unique: true, baseField: "code" },
      { fieldKey: "name", label: "Name", dataType: "TEXT", required: true, baseField: "name" },
      { fieldKey: "rate", label: "Rate", dataType: "NUMBER", required: true, baseField: "rate" },
    ],
  },
  {
    name: "NumberSeries",
    label: "Number Series",
    fields: [
      { fieldKey: "key", label: "Series Key", dataType: "TEXT", required: true, unique: true, baseField: "key" },
      { fieldKey: "pattern", label: "Pattern", dataType: "TEXT", required: true, baseField: "pattern" },
      { fieldKey: "resetPolicy", label: "Reset Policy", dataType: "SELECT", required: true, baseField: "resetPolicy" },
    ],
  },
  {
    name: "Warehouse",
    label: "Warehouse",
    fields: [
      { fieldKey: "code", label: "Code", dataType: "TEXT", required: true, unique: true, baseField: "code" },
      { fieldKey: "name", label: "Name", dataType: "TEXT", required: true, baseField: "name" },
      { fieldKey: "isActive", label: "Active", dataType: "BOOLEAN", baseField: "isActive" },
    ],
  },
  {
    name: "Location",
    label: "Location",
    fields: [
      { fieldKey: "warehouseId", label: "Warehouse", dataType: "LINK", required: true, baseField: "warehouseId" },
      { fieldKey: "code", label: "Code", dataType: "TEXT", required: true, baseField: "code" },
      { fieldKey: "name", label: "Name", dataType: "TEXT", required: true, baseField: "name" },
    ],
  },
];

export async function seedCoreMetaModels(ctx: PlatformRequestContext): Promise<{ createdModels: number; createdFields: number }> {
  let createdModels = 0;
  let createdFields = 0;

  for (const modelDef of coreMetaSeed) {
    const existing = await prisma.metaModel.findFirst({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: modelDef.name,
      },
      select: { id: true },
    });

    const model =
      existing ??
      (await prisma.metaModel.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          name: modelDef.name,
          label: modelDef.label,
          isCore: true,
          draftConfig: {},
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
        select: { id: true },
      }));

    if (!existing) createdModels += 1;

    for (const [index, field] of modelDef.fields.entries()) {
      const existingField = await prisma.metaFieldDef.findFirst({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          modelName: modelDef.name,
          fieldKey: field.fieldKey,
        },
        select: { id: true },
      });

      await prisma.metaFieldDef.upsert({
        where: {
          tenantId_companyId_modelName_fieldKey: {
            tenantId: ctx.tenantId,
            companyId: ctx.companyId,
            modelName: modelDef.name,
            fieldKey: field.fieldKey,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          modelName: modelDef.name,
          metaModelId: model.id,
          fieldKey: field.fieldKey,
          label: field.label,
          dataType: field.dataType,
          required: field.required ?? false,
          unique: field.unique ?? false,
          readOnly: true,
          sortOrder: field.sortOrder ?? index,
          baseField: field.baseField ?? null,
          isActive: true,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
        update: {
          label: field.label,
          dataType: field.dataType,
          required: field.required ?? false,
          unique: field.unique ?? false,
          readOnly: true,
          baseField: field.baseField ?? null,
          sortOrder: field.sortOrder ?? index,
          isActive: true,
          updatedBy: ctx.userId,
        },
      });

      if (!existingField) {
        createdFields += 1;
      }
    }
  }

  return { createdModels, createdFields };
}

function assertWorkflowDraft(ctx: PlatformRequestContext, input: WorkflowDraftInput): void {
  const stateKeys = new Set(input.states.map((state) => state.stateKey));
  if (stateKeys.size !== input.states.length) {
    throw new PlatformError("VALIDATION_ERROR", "Workflow states must have unique keys");
  }
  if (!input.states.some((state) => state.isInitial)) {
    throw new PlatformError("VALIDATION_ERROR", "Workflow must define at least one initial state");
  }

  for (const transition of input.transitions) {
    if (!stateKeys.has(transition.fromState) || !stateKeys.has(transition.toState)) {
      throw new PlatformError("VALIDATION_ERROR", "Workflow transition references unknown state");
    }
    assertPermissionCeiling(ctx, transition.requiredPermissions ?? []);
    validateJsonLogicExpression(transition.conditions);
  }
}

async function compileAndPersist(
  ctx: PlatformRequestContext,
  model: {
    id: string;
    name: string;
    latestVersion: number;
    draftConfig: Prisma.JsonValue | null;
  },
): Promise<{ version: number; etag: string; payload: Record<string, unknown> }> {
  const [fields, policies, workflows] = await Promise.all([
    prisma.metaFieldDef.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        modelName: model.name,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.metaPermissionPolicy.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        modelName: model.name,
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.metaWorkflowTransition.findMany({
      where: {
        workflowDef: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          modelName: model.name,
          isPublished: true,
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const nextVersion = model.latestVersion + 1;
  const compiled = compileMetaPayload({
    modelName: model.name,
    version: nextVersion,
    fields,
    permissions: policies,
    transitions: workflows,
  });

  await prisma.$transaction(async (tx) => {
    await tx.compiledMeta.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        modelName: model.name,
        metaModelId: model.id,
        version: nextVersion,
        etag: compiled.etag,
        validationSchema: compiled.payload.validationSchema as Prisma.InputJsonValue,
        uiSchema: compiled.payload.uiSchema as Prisma.InputJsonValue,
        searchHints: compiled.payload.searchHints as Prisma.InputJsonValue,
        permissionSummary: compiled.payload.permissionSummary as Prisma.InputJsonValue,
        workflowSummary: compiled.payload.workflowSummary as Prisma.InputJsonValue,
        indexHints: compiled.payload.indexHints as Prisma.InputJsonValue,
        compiledBy: ctx.userId,
      },
    });

    await tx.metaModel.update({
      where: { id: model.id },
      data: {
        latestVersion: nextVersion,
        publishedVersion: nextVersion,
        publishedConfig: model.draftConfig === null ? Prisma.JsonNull : (model.draftConfig as Prisma.InputJsonValue),
        updatedBy: ctx.userId,
      },
    });
  });

  invalidateCompiledMetaCache({
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    modelName: model.name,
  });

  return { version: nextVersion, etag: compiled.etag, payload: compiled.payload };
}

export async function listMetaModels(
  ctx: PlatformRequestContext,
  input: { page: number; limit: number },
) {
  await seedCoreMetaModels(ctx);
  const includeDrafts = hasDraftReadPermission(ctx);

  const where = {
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
  };

  const [rows, total] = await Promise.all([
    prisma.metaModel.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: pageToSkip(input.page, input.limit),
      take: input.limit,
    }),
    prisma.metaModel.count({ where }),
  ]);

  return {
    page: input.page,
    limit: input.limit,
    total,
    rows: rows.map((row) => ({
      ...row,
      draftConfig: includeDrafts ? row.draftConfig : null,
    })),
  };
}

export async function getMetaModel(ctx: PlatformRequestContext, modelName: string) {
  const includeDrafts = hasDraftReadPermission(ctx);

  const row = await prisma.metaModel.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      name: normalizeModelName(modelName),
    },
    include: {
      fields: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      workflows: {
        include: {
          states: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          transitions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
        orderBy: [{ version: "desc" }],
      },
      printTemplates: {
        where: { isActive: true },
        orderBy: [{ updatedAt: "desc" }],
      },
      permissionPolicies: {
        orderBy: [{ createdAt: "asc" }],
      },
      customPermissionTypes: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!row) {
    throw new PlatformError("NOT_FOUND", `Meta model '${modelName}' not found`);
  }

  let publishedFields: Array<Record<string, unknown>> = [];
  if (!includeDrafts && row.publishedVersion > 0) {
    const compiled = await prisma.compiledMeta.findFirst({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        modelName: row.name,
        version: row.publishedVersion,
      },
      select: {
        uiSchema: true,
      },
    });

    const uiSchema = compiled?.uiSchema as { fields?: unknown } | null;
    if (uiSchema && Array.isArray(uiSchema.fields)) {
      publishedFields = uiSchema.fields.filter(
        (entry): entry is Record<string, unknown> => !!entry && typeof entry === "object" && !Array.isArray(entry),
      );
    }
  }

  return {
    ...row,
    draftConfig: includeDrafts ? row.draftConfig : null,
    fields: includeDrafts ? row.fields : publishedFields,
    workflows: includeDrafts ? row.workflows : row.workflows.filter((workflow) => workflow.isPublished),
    printTemplates: includeDrafts
      ? row.printTemplates
      : row.printTemplates.map((template) => ({
          ...template,
          draftTemplate: "",
          draftCss: null,
        })),
  };
}

export async function createMetaModel(
  ctx: PlatformRequestContext,
  input: {
    name: string;
    label: string;
    isCore?: boolean;
    draftConfig?: Record<string, unknown>;
  },
) {
  const name = normalizeModelName(input.name);

  const created = await prisma.metaModel.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      name,
      label: input.label,
      isCore: input.isCore ?? false,
      latestVersion: 1,
      publishedVersion: 0,
      draftConfig: (input.draftConfig ?? {}) as Prisma.InputJsonValue,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });

  await appendMetaChange(ctx, {
    modelName: name,
    entityType: "MetaModel",
    entityId: created.id,
    action: "meta.model.created",
    after: created,
  });

  await appendAuditEvent(ctx, {
    source: "meta.model",
    action: "meta.model.created",
    entityType: "MetaModel",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updateMetaModel(
  ctx: PlatformRequestContext,
  modelName: string,
  input: {
    label?: string;
    draftConfig?: Record<string, unknown>;
    action?: "SAVE_DRAFT" | "PUBLISH";
  },
) {
  const existing = await getModelByNameOrThrow(ctx, modelName);

  const updated = await prisma.metaModel.update({
    where: { id: existing.id },
    data: {
      label: input.label,
      draftConfig: input.draftConfig
        ? (input.draftConfig as Prisma.InputJsonValue)
        : undefined,
      updatedBy: ctx.userId,
    },
  });

  await appendMetaChange(ctx, {
    modelName: existing.name,
    entityType: "MetaModel",
    entityId: existing.id,
    action: input.action === "PUBLISH" ? "meta.model.publish.requested" : "meta.model.updated",
    before: existing,
    after: updated,
  });

  if (input.action === "PUBLISH") {
    assertCanPublish(ctx);
    return publishMetaModel(ctx, existing.name);
  }

  return updated;
}

export async function publishMetaModel(ctx: PlatformRequestContext, modelName: string) {
  assertCanPublish(ctx);
  const model = await getModelByNameOrThrow(ctx, modelName);

  const compiled = await compileAndPersist(ctx, model);

  await appendMetaChange(ctx, {
    modelName: model.name,
    entityType: "CompiledMeta",
    entityId: `${model.name}:${compiled.version}`,
    action: "meta.model.published",
    after: {
      version: compiled.version,
      etag: compiled.etag,
    },
  });

  await appendAuditEvent(ctx, {
    source: "meta.model",
    action: "meta.model.published",
    entityType: "MetaModel",
    entityId: model.id,
    after: { version: compiled.version, etag: compiled.etag },
  });

  return compiled;
}

export async function getCompiledMeta(
  ctx: PlatformRequestContext,
  modelName: string,
  input: { version?: number },
) {
  const model = await getModelByNameOrThrow(ctx, modelName);
  const version = input.version ?? model.publishedVersion;
  if (!version || version < 1) {
    throw new PlatformError("NOT_FOUND", `No published metadata for model '${modelName}'`);
  }

  const cache = getCompiledMetaCache({
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    modelName: model.name,
    version,
  });
  if (cache) return cache;

  const row = await prisma.compiledMeta.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      modelName: model.name,
      version,
    },
  });

  if (!row) {
    throw new PlatformError("NOT_FOUND", `Compiled metadata version '${version}' not found`);
  }

  const payload = {
    modelName: row.modelName,
    version: row.version,
    validationSchema: row.validationSchema,
    uiSchema: row.uiSchema,
    searchHints: row.searchHints,
    permissionSummary: row.permissionSummary,
    workflowSummary: row.workflowSummary,
    indexHints: row.indexHints,
  } as Record<string, unknown>;

  const compiled = {
    etag: row.etag,
    payload,
  };

  setCompiledMetaCache(
    {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      modelName: model.name,
      version,
    },
    compiled,
  );

  return compiled;
}

export async function upsertMetaCustomField(
  ctx: PlatformRequestContext,
  input: {
    modelName: string;
    fieldKey: string;
    label: string;
    dataType: CustomFieldDataType;
    required?: boolean;
    unique?: boolean;
    readOnly?: boolean;
    sortOrder?: number;
    baseField?: string | null;
    defaultValue?: unknown;
    options?: Record<string, unknown>;
    ui?: Record<string, unknown>;
    validation?: unknown;
    isActive?: boolean;
  },
) {
  const model = await getModelByNameOrThrow(ctx, input.modelName);
  validateJsonLogicExpression((input.validation as { jsonLogic?: unknown } | undefined)?.jsonLogic);

  const saved = await prisma.metaFieldDef.upsert({
    where: {
      tenantId_companyId_modelName_fieldKey: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        modelName: model.name,
        fieldKey: input.fieldKey,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      modelName: model.name,
      metaModelId: model.id,
      fieldKey: input.fieldKey,
      label: input.label,
      dataType: input.dataType,
      required: input.required ?? false,
      unique: input.unique ?? false,
      readOnly: input.readOnly ?? false,
      sortOrder: input.sortOrder ?? 0,
      baseField: input.baseField ?? null,
      defaultValue: (input.defaultValue ?? null) as Prisma.InputJsonValue,
      options: (input.options ?? null) as Prisma.InputJsonValue,
      ui: (input.ui ?? null) as Prisma.InputJsonValue,
      validation: (input.validation ?? null) as Prisma.InputJsonValue,
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    update: {
      label: input.label,
      dataType: input.dataType,
      required: input.required ?? false,
      unique: input.unique ?? false,
      readOnly: input.readOnly ?? false,
      sortOrder: input.sortOrder ?? 0,
      baseField: input.baseField ?? null,
      defaultValue: (input.defaultValue ?? null) as Prisma.InputJsonValue,
      options: (input.options ?? null) as Prisma.InputJsonValue,
      ui: (input.ui ?? null) as Prisma.InputJsonValue,
      validation: (input.validation ?? null) as Prisma.InputJsonValue,
      isActive: input.isActive ?? true,
      updatedBy: ctx.userId,
    },
  });

  await appendMetaChange(ctx, {
    modelName: model.name,
    entityType: "MetaFieldDef",
    entityId: saved.id,
    action: "meta.field.upserted",
    after: saved,
  });

  await appendAuditEvent(ctx, {
    source: "meta.field",
    action: "meta.field.upserted",
    entityType: "MetaFieldDef",
    entityId: saved.id,
    after: saved,
  });

  return saved;
}

export async function deleteMetaCustomField(ctx: PlatformRequestContext, id: string) {
  const row = await prisma.metaFieldDef.findFirst({
    where: {
      id,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
  });

  if (!row) throw new PlatformError("NOT_FOUND", "Custom field not found");

  await prisma.metaFieldDef.delete({ where: { id: row.id } });

  await appendMetaChange(ctx, {
    modelName: row.modelName,
    entityType: "MetaFieldDef",
    entityId: row.id,
    action: "meta.field.deleted",
    before: row,
  });

  await appendAuditEvent(ctx, {
    source: "meta.field",
    action: "meta.field.deleted",
    entityType: "MetaFieldDef",
    entityId: row.id,
    before: row,
  });

  return { id: row.id };
}

export async function saveWorkflowDraft(ctx: PlatformRequestContext, modelName: string, input: WorkflowDraftInput) {
  const model = await getModelByNameOrThrow(ctx, modelName);
  assertWorkflowDraft(ctx, input);

  const latest = await prisma.metaWorkflowDef.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      modelName: model.name,
    },
    orderBy: [{ version: "desc" }],
    select: { version: true },
  });

  const version = (latest?.version ?? 0) + 1;

  const saved = await prisma.$transaction(async (tx) => {
    const workflow = await tx.metaWorkflowDef.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        modelName: model.name,
        metaModelId: model.id,
        version,
        isPublished: false,
        isActive: true,
        notes: input.notes ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });

    if (input.states.length > 0) {
      await tx.metaWorkflowState.createMany({
        data: input.states.map((state) => ({
          workflowDefId: workflow.id,
          stateKey: state.stateKey,
          label: state.label,
          isInitial: state.isInitial ?? false,
          isTerminal: state.isTerminal ?? false,
          sortOrder: state.sortOrder ?? 0,
          config: (state.config ?? null) as Prisma.InputJsonValue,
        })),
      });
    }

    if (input.transitions.length > 0) {
      await tx.metaWorkflowTransition.createMany({
        data: input.transitions.map((transition) => ({
          workflowDefId: workflow.id,
          actionKey: transition.actionKey,
          fromState: transition.fromState,
          toState: transition.toState,
          requiredPermissions: (transition.requiredPermissions ?? []) as Prisma.InputJsonValue,
          conditions: (transition.conditions ?? null) as Prisma.InputJsonValue,
          sortOrder: transition.sortOrder ?? 0,
        })),
      });
    }

    return tx.metaWorkflowDef.findUniqueOrThrow({
      where: { id: workflow.id },
      include: {
        states: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        transitions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
    });
  });

  await appendMetaChange(ctx, {
    modelName: model.name,
    entityType: "MetaWorkflowDef",
    entityId: saved.id,
    action: "meta.workflow.draft.saved",
    after: saved,
  });

  await appendAuditEvent(ctx, {
    source: "meta.workflow",
    action: "meta.workflow.draft.saved",
    entityType: "MetaWorkflowDef",
    entityId: saved.id,
    after: saved,
  });

  return saved;
}

export async function publishWorkflowDraft(ctx: PlatformRequestContext, modelName: string) {
  assertCanPublish(ctx);
  const model = await getModelByNameOrThrow(ctx, modelName);

  const draft = await prisma.metaWorkflowDef.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      modelName: model.name,
      isPublished: false,
    },
    orderBy: [{ version: "desc" }],
  });

  if (!draft) {
    throw new PlatformError("NOT_FOUND", "No workflow draft to publish");
  }

  await prisma.$transaction(async (tx) => {
    await tx.metaWorkflowDef.updateMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        modelName: model.name,
        isPublished: true,
      },
      data: {
        isPublished: false,
        updatedBy: ctx.userId,
      },
    });

    await tx.metaWorkflowDef.update({
      where: { id: draft.id },
      data: {
        isPublished: true,
        updatedBy: ctx.userId,
      },
    });
  });

  const compiled = await compileAndPersist(ctx, model);

  await appendMetaChange(ctx, {
    modelName: model.name,
    entityType: "MetaWorkflowDef",
    entityId: draft.id,
    action: "meta.workflow.published",
    after: { workflowVersion: draft.version, compiledVersion: compiled.version },
  });

  await appendAuditEvent(ctx, {
    source: "meta.workflow",
    action: "meta.workflow.published",
    entityType: "MetaWorkflowDef",
    entityId: draft.id,
    after: { workflowVersion: draft.version, compiledVersion: compiled.version },
  });

  return {
    workflowVersion: draft.version,
    compiledVersion: compiled.version,
    etag: compiled.etag,
  };
}

export async function getWorkflowForModel(ctx: PlatformRequestContext, modelName: string) {
  const includeDrafts = hasDraftReadPermission(ctx);
  const rows = await prisma.metaWorkflowDef.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      modelName: normalizeModelName(modelName),
      ...(includeDrafts ? {} : { isPublished: true }),
    },
    include: {
      states: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      transitions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
    orderBy: [{ version: "desc" }],
  });

  return rows;
}

export async function enforcePublishedWorkflowTransition(
  ctx: PlatformRequestContext,
  input: {
    modelName: string;
    fromState: string;
    toState: string;
    actionKey?: string;
  },
): Promise<void> {
  const workflow = await prisma.metaWorkflowDef.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      modelName: normalizeModelName(input.modelName),
      isPublished: true,
      isActive: true,
    },
    orderBy: [{ version: "desc" }],
    include: {
      transitions: true,
    },
  });

  if (!workflow) {
    return;
  }

  const matching = workflow.transitions.filter((transition) => {
    if (transition.fromState !== input.fromState || transition.toState !== input.toState) return false;
    if (!input.actionKey) return true;
    return transition.actionKey === input.actionKey;
  });

  if (matching.length === 0) {
    throw new PlatformError(
      "FORBIDDEN",
      `Workflow transition '${input.fromState}' -> '${input.toState}' is not allowed for model '${input.modelName}'`,
    );
  }

  const allowedByPermission = matching.some((transition) => {
    const requiredPermissions = asStringList(transition.requiredPermissions);
    if (requiredPermissions.length === 0) return true;
    return requiredPermissions.every((permission) => ctx.permissions.includes(permission));
  });

  if (!allowedByPermission) {
    throw new PlatformError("FORBIDDEN", "Missing required permissions for workflow transition");
  }
}

export async function upsertPrintTemplate(
  ctx: PlatformRequestContext,
  input: {
    modelName: string;
    name: string;
    templateType: string;
    draftTemplate: string;
    draftCss?: string | null;
    variablesSchema?: Record<string, unknown>;
    isDefault?: boolean;
    isActive?: boolean;
  },
) {
  const model = await getModelByNameOrThrow(ctx, input.modelName);

  const saved = await prisma.metaPrintTemplate.upsert({
    where: {
      tenantId_companyId_modelName_name: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        modelName: model.name,
        name: input.name,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      modelName: model.name,
      metaModelId: model.id,
      name: input.name,
      templateType: input.templateType,
      draftTemplate: input.draftTemplate,
      draftCss: input.draftCss ?? null,
      variablesSchema: (input.variablesSchema ?? null) as Prisma.InputJsonValue,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    update: {
      templateType: input.templateType,
      draftTemplate: input.draftTemplate,
      draftCss: input.draftCss ?? null,
      variablesSchema: (input.variablesSchema ?? null) as Prisma.InputJsonValue,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      updatedBy: ctx.userId,
    },
  });

  await appendMetaChange(ctx, {
    modelName: model.name,
    entityType: "MetaPrintTemplate",
    entityId: saved.id,
    action: "meta.template.upserted",
    after: saved,
  });

  return saved;
}

export async function publishPrintTemplate(ctx: PlatformRequestContext, templateId: string) {
  assertCanPublish(ctx);
  const existing = await prisma.metaPrintTemplate.findFirst({
    where: {
      id: templateId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
    },
  });

  if (!existing) {
    throw new PlatformError("NOT_FOUND", "Print template not found");
  }

  const next = await prisma.metaPrintTemplate.update({
    where: { id: existing.id },
    data: {
      publishedTemplate: existing.draftTemplate,
      publishedCss: existing.draftCss,
      publishedVersion: existing.publishedVersion + 1,
      version: existing.version + 1,
      updatedBy: ctx.userId,
    },
  });

  await appendMetaChange(ctx, {
    modelName: existing.modelName,
    entityType: "MetaPrintTemplate",
    entityId: existing.id,
    action: "meta.template.published",
    before: existing,
    after: next,
  });

  await appendAuditEvent(ctx, {
    source: "meta.template",
    action: "meta.template.published",
    entityType: "MetaPrintTemplate",
    entityId: existing.id,
    before: existing,
    after: next,
  });

  return next;
}

async function loadTemplateRecord(
  ctx: PlatformRequestContext,
  modelName: string,
  recordId: string,
): Promise<Record<string, unknown>> {
  if (modelName === "Party") {
    const row = await prisma.masterParty.findFirst({
      where: { id: recordId, tenantId: ctx.tenantId, companyId: ctx.companyId },
      include: {
        addresses: true,
        contacts: true,
      },
    });
    if (!row) throw new PlatformError("NOT_FOUND", "Party record not found");
    return row as unknown as Record<string, unknown>;
  }

  if (modelName === "Item" || modelName === "Product") {
    const row = await prisma.product.findFirst({
      where: { id: recordId, companyId: ctx.companyId },
    });
    if (!row) throw new PlatformError("NOT_FOUND", "Item record not found");
    return row as unknown as Record<string, unknown>;
  }

  if (modelName === "PriceList") {
    const row = await prisma.masterPriceList.findFirst({
      where: { id: recordId, tenantId: ctx.tenantId, companyId: ctx.companyId },
      include: { items: true },
    });
    if (!row) throw new PlatformError("NOT_FOUND", "Price list record not found");
    return row as unknown as Record<string, unknown>;
  }

  throw new PlatformError("VALIDATION_ERROR", `No record renderer configured for model '${modelName}'`);
}

export async function renderPublishedTemplate(
  ctx: PlatformRequestContext,
  templateId: string,
  input: { recordId: string },
) {
  const template = await prisma.metaPrintTemplate.findFirst({
    where: {
      id: templateId,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      isActive: true,
    },
  });

  if (!template) {
    throw new PlatformError("NOT_FOUND", "Print template not found");
  }

  const allowDraft = hasDraftReadPermission(ctx);
  const sourceTemplate = template.publishedTemplate ?? (allowDraft ? template.draftTemplate : null);

  if (!sourceTemplate) {
    throw new PlatformError("NOT_FOUND", "Template is not published");
  }

  const record = await loadTemplateRecord(ctx, template.modelName, input.recordId);
  const rendered = renderMustacheStrict(sourceTemplate, record);
  const sanitized = process.env.META_TEMPLATE_SANITIZE_STRICT === "0" ? rendered : stripUnsafeHtml(rendered);

  await appendAuditEvent(ctx, {
    source: "meta.template",
    action: "meta.template.rendered",
    entityType: "MetaPrintTemplate",
    entityId: template.id,
    metadata: {
      modelName: template.modelName,
      recordId: input.recordId,
      recordIdMasked: piiMasked(input.recordId),
    },
  });

  return {
    templateId: template.id,
    modelName: template.modelName,
    recordId: input.recordId,
    html: sanitized,
    format: "HTML",
    pdf: {
      supported: false,
      todo: "Server-side PDF generation is deferred for this release.",
    },
  };
}

export async function exportMetaBundle(ctx: PlatformRequestContext, input: { model?: string }) {
  const maxRows = Number.parseInt(process.env.META_EXPORT_MAX_ROWS ?? "200", 10);
  const limit = Number.isFinite(maxRows) ? Math.min(Math.max(maxRows, 10), 2000) : 200;

  const models = await prisma.metaModel.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      ...(input.model ? { name: input.model } : {}),
    },
    include: {
      fields: true,
      workflows: {
        include: {
          states: true,
          transitions: true,
        },
      },
      printTemplates: true,
      permissionPolicies: true,
      customPermissionTypes: true,
      compiledMetas: {
        orderBy: [{ version: "desc" }],
        take: 10,
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
  });

  return {
    exportedAt: new Date().toISOString(),
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    count: models.length,
    models,
  };
}

export async function importMetaBundle(
  ctx: PlatformRequestContext,
  input: {
    models: Array<{
      model: {
        name: string;
        label: string;
        isCore?: boolean;
        draftConfig?: Record<string, unknown>;
      };
      fields: Array<{
        modelName: string;
        fieldKey: string;
        label: string;
        dataType: CustomFieldDataType;
        required?: boolean;
        unique?: boolean;
        readOnly?: boolean;
        sortOrder?: number;
        baseField?: string | null;
        defaultValue?: unknown;
        options?: Record<string, unknown>;
        ui?: Record<string, unknown>;
        validation?: unknown;
        isActive?: boolean;
      }>;
      workflows: Array<WorkflowDraftInput & { isPublished?: boolean }>;
      printTemplates: Array<{
        modelName: string;
        name: string;
        templateType: string;
        draftTemplate: string;
        draftCss?: string | null;
        variablesSchema?: Record<string, unknown>;
        isDefault?: boolean;
        isActive?: boolean;
      }>;
    }>;
  },
) {
  let created = 0;
  let updated = 0;

  for (const row of input.models) {
    const existing = await prisma.metaModel.findFirst({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: row.model.name,
      },
      select: { id: true },
    });

    if (existing) {
      await updateMetaModel(ctx, row.model.name, {
        label: row.model.label,
        draftConfig: row.model.draftConfig,
        action: "SAVE_DRAFT",
      });
      updated += 1;
    } else {
      await createMetaModel(ctx, row.model);
      created += 1;
    }

    for (const field of row.fields) {
      await upsertMetaCustomField(ctx, field);
    }

    for (const workflow of row.workflows) {
      const saved = await saveWorkflowDraft(ctx, row.model.name, workflow);
      if (workflow.isPublished) {
        await publishWorkflowDraft(ctx, row.model.name);
      }
      void saved;
    }

    for (const template of row.printTemplates) {
      await upsertPrintTemplate(ctx, template);
    }
  }

  await appendAuditEvent(ctx, {
    source: "meta.import",
    action: "meta.import.completed",
    entityType: "MetaModel",
    metadata: {
      created,
      updated,
      total: input.models.length,
    },
  });

  return {
    created,
    updated,
    total: input.models.length,
  };
}

export async function listMetaAudit(
  ctx: PlatformRequestContext,
  input: { model?: string; since?: Date; limit: number },
) {
  return prisma.metaChangeLog.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      ...(input.model ? { modelName: input.model } : {}),
      ...(input.since ? { createdAt: { gte: input.since } } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: input.limit,
  });
}

export async function validateCustomDataAgainstPublishedMetadata(
  ctx: PlatformRequestContext,
  modelName: string,
  customData: Record<string, unknown> | null | undefined,
): Promise<void> {
  const model = await prisma.metaModel.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      name: normalizeModelName(modelName),
      publishedVersion: { gt: 0 },
    },
    select: { id: true, name: true, publishedVersion: true },
  });

  if (!model) return;

  const compiled = await getCompiledMeta(ctx, model.name, { version: model.publishedVersion });
  validateCustomDataWithCompiledSchema(compiled.payload.validationSchema, customData);
}

export async function listMetaFields(
  ctx: PlatformRequestContext,
  modelName: string,
): Promise<Array<{ fieldKey: string; required: boolean; dataType: CustomFieldDataType }>> {
  const model = await getModelByNameOrThrow(ctx, modelName);

  return prisma.metaFieldDef.findMany({
    where: {
      metaModelId: model.id,
      isActive: true,
    },
    select: {
      fieldKey: true,
      required: true,
      dataType: true,
    },
  });
}
