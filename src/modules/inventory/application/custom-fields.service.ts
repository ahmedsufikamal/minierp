import { InventoryCustomFieldEntityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { InventoryError } from "@/modules/inventory/domain/errors";
import { validateCustomFieldValue } from "@/modules/inventory/domain/custom-fields";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { customFieldDefinitionSchema } from "@/modules/inventory/application/schemas";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";

export async function listCustomFieldDefinitions(ctx: InventoryRequestContext, entityType?: InventoryCustomFieldEntityType) {
  return prisma.inventoryCustomFieldDefinition.findMany({
    where: {
      companyId: ctx.companyId,
      ...(entityType ? { entityType } : {}),
    },
    orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createCustomFieldDefinition(ctx: InventoryRequestContext, input: unknown) {
  const parsed = customFieldDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid custom field definition", parsed.error.flatten());
  }

  const existing = await prisma.inventoryCustomFieldDefinition.findUnique({
    where: {
      companyId_entityType_key: {
        companyId: ctx.companyId,
        entityType: parsed.data.entityType,
        key: parsed.data.key,
      },
    },
  });

  if (existing) {
    throw new InventoryError("CONFLICT", `Field key '${parsed.data.key}' already exists for this entity`);
  }

  const created = await prisma.inventoryCustomFieldDefinition.create({
    data: {
      companyId: ctx.companyId,
      entityType: parsed.data.entityType,
      key: parsed.data.key,
      label: parsed.data.label,
      description: parsed.data.description,
      fieldType: parsed.data.fieldType,
      required: parsed.data.required,
      unique: parsed.data.unique,
      indexed: parsed.data.indexed,
      showInList: parsed.data.showInList,
      config: (parsed.data.config ?? null) as Prisma.InputJsonValue,
      defaultValue: (parsed.data.defaultValue ?? null) as Prisma.InputJsonValue,
      validationRules: (parsed.data.validationRules ?? null) as Prisma.InputJsonValue,
      visibilityRoles: (parsed.data.visibilityRoles ?? null) as Prisma.InputJsonValue,
      isActive: parsed.data.isActive,
      sortOrder: parsed.data.sortOrder,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });

  await writeInventoryAudit(ctx, {
    action: "CUSTOM_FIELD_CREATED",
    entityType: "InventoryCustomFieldDefinition",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updateCustomFieldDefinition(ctx: InventoryRequestContext, id: string, input: unknown) {
  const parsed = customFieldDefinitionSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid custom field definition", parsed.error.flatten());
  }

  const existing = await prisma.inventoryCustomFieldDefinition.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Custom field definition not found");
  }

  const writeResult = await prisma.inventoryCustomFieldDefinition.updateMany({
    where: { id, companyId: ctx.companyId },
    data: {
      ...parsed.data,
      config: parsed.data.config === undefined ? undefined : (parsed.data.config as Prisma.InputJsonValue),
      defaultValue:
        parsed.data.defaultValue === undefined ? undefined : (parsed.data.defaultValue as Prisma.InputJsonValue),
      validationRules:
        parsed.data.validationRules === undefined
          ? undefined
          : (parsed.data.validationRules as Prisma.InputJsonValue),
      visibilityRoles:
        parsed.data.visibilityRoles === undefined
          ? undefined
          : (parsed.data.visibilityRoles as Prisma.InputJsonValue),
      updatedBy: ctx.userId,
    },
  });
  if (writeResult.count === 0) {
    throw new InventoryError("NOT_FOUND", "Custom field definition not found");
  }

  const updated = await prisma.inventoryCustomFieldDefinition.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!updated) {
    throw new InventoryError("NOT_FOUND", "Custom field definition not found");
  }

  await writeInventoryAudit(ctx, {
    action: "CUSTOM_FIELD_UPDATED",
    entityType: "InventoryCustomFieldDefinition",
    entityId: updated.id,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function archiveCustomFieldDefinition(ctx: InventoryRequestContext, id: string) {
  const existing = await prisma.inventoryCustomFieldDefinition.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Custom field definition not found");
  }

  const writeResult = await prisma.inventoryCustomFieldDefinition.updateMany({
    where: { id, companyId: ctx.companyId },
    data: { isActive: false, updatedBy: ctx.userId },
  });
  if (writeResult.count === 0) {
    throw new InventoryError("NOT_FOUND", "Custom field definition not found");
  }

  const updated = await prisma.inventoryCustomFieldDefinition.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!updated) {
    throw new InventoryError("NOT_FOUND", "Custom field definition not found");
  }

  await writeInventoryAudit(ctx, {
    action: "CUSTOM_FIELD_ARCHIVED",
    entityType: "InventoryCustomFieldDefinition",
    entityId: updated.id,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function setEntityCustomFieldValues(
  ctx: InventoryRequestContext,
  params: {
    entityType: InventoryCustomFieldEntityType;
    entityId: string;
    fields: Record<string, unknown>;
  },
) {
  const definitions = await prisma.inventoryCustomFieldDefinition.findMany({
    where: {
      companyId: ctx.companyId,
      entityType: params.entityType,
      isActive: true,
      key: { in: Object.keys(params.fields) },
    },
  });

  const defByKey = new Map(definitions.map((d) => [d.key, d]));

  for (const key of Object.keys(params.fields)) {
    if (!defByKey.has(key)) {
      throw new InventoryError("VALIDATION_ERROR", `Unknown custom field key '${key}'`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const writes = [] as Array<Promise<unknown>>;

    for (const [key, rawValue] of Object.entries(params.fields)) {
      const def = defByKey.get(key);
      if (!def) continue;

      const normalizedValue = validateCustomFieldValue(def, rawValue);

      if (def.unique && normalizedValue !== Prisma.JsonNull) {
        const conflict = await tx.inventoryCustomFieldValue.findFirst({
          where: {
            companyId: ctx.companyId,
            entityType: params.entityType,
            fieldDefinitionId: def.id,
            entityId: { not: params.entityId },
            value: { equals: normalizedValue },
          },
          select: { id: true },
        });

        if (conflict) {
          throw new InventoryError("CONFLICT", `Custom field '${key}' must be unique`);
        }
      }

      writes.push(
        tx.inventoryCustomFieldValue.upsert({
          where: {
            companyId_entityType_entityId_fieldDefinitionId: {
              companyId: ctx.companyId,
              entityType: params.entityType,
              entityId: params.entityId,
              fieldDefinitionId: def.id,
            },
          },
          create: {
            companyId: ctx.companyId,
            entityType: params.entityType,
            entityId: params.entityId,
            fieldDefinitionId: def.id,
            value: normalizedValue,
          },
          update: {
            value: normalizedValue,
          },
        }),
      );
    }

    await Promise.all(writes);
  });
}

export async function bulkSetCustomFieldValues(
  ctx: InventoryRequestContext,
  params: {
    entityType: InventoryCustomFieldEntityType;
    updates: Array<{ entityId: string; fields: Record<string, unknown> }>;
  },
) {
  for (const update of params.updates) {
    await setEntityCustomFieldValues(ctx, {
      entityType: params.entityType,
      entityId: update.entityId,
      fields: update.fields,
    });
  }
}

export async function getCustomFieldValuesByEntityIds(
  ctx: InventoryRequestContext,
  params: {
    entityType: InventoryCustomFieldEntityType;
    entityIds: string[];
  },
): Promise<Record<string, Record<string, unknown>>> {
  if (params.entityIds.length === 0) return {};

  const rows = await prisma.inventoryCustomFieldValue.findMany({
    where: {
      companyId: ctx.companyId,
      entityType: params.entityType,
      entityId: { in: params.entityIds },
    },
    include: {
      fieldDefinition: {
        select: {
          key: true,
        },
      },
    },
  });

  const byEntity: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    if (!byEntity[row.entityId]) {
      byEntity[row.entityId] = {};
    }
    byEntity[row.entityId][row.fieldDefinition.key] = row.value;
  }

  return byEntity;
}

export async function exportCustomFieldSchema(ctx: InventoryRequestContext, entityType?: InventoryCustomFieldEntityType) {
  return listCustomFieldDefinitions(ctx, entityType);
}

export async function importCustomFieldSchema(
  ctx: InventoryRequestContext,
  rows: unknown[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const parsed = customFieldDefinitionSchema.safeParse(row);
    if (!parsed.success) {
      throw new InventoryError("VALIDATION_ERROR", "Invalid custom field schema payload", parsed.error.flatten());
    }

    const existing = await prisma.inventoryCustomFieldDefinition.findUnique({
      where: {
        companyId_entityType_key: {
          companyId: ctx.companyId,
          entityType: parsed.data.entityType,
          key: parsed.data.key,
        },
      },
    });

    if (existing) {
      await updateCustomFieldDefinition(ctx, existing.id, parsed.data);
      updated += 1;
    } else {
      await createCustomFieldDefinition(ctx, parsed.data);
      created += 1;
    }
  }

  return { created, updated };
}
