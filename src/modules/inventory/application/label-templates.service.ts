import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { labelTemplateSchema } from "@/modules/inventory/application/schemas";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";

export async function listLabelTemplates(ctx: InventoryRequestContext) {
  return prisma.inventoryLabelTemplate.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createLabelTemplate(ctx: InventoryRequestContext, input: unknown) {
  const parsed = labelTemplateSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid label template payload", parsed.error.flatten());
  }

  const existing = await prisma.inventoryLabelTemplate.findUnique({
    where: {
      companyId_name: {
        companyId: ctx.companyId,
        name: parsed.data.name,
      },
    },
  });

  if (existing) {
    throw new InventoryError("CONFLICT", "Label template name already exists");
  }

  const created = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.inventoryLabelTemplate.updateMany({
        where: { companyId: ctx.companyId, paperType: parsed.data.paperType, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.inventoryLabelTemplate.create({
      data: {
        companyId: ctx.companyId,
        name: parsed.data.name,
        paperType: parsed.data.paperType,
        widthMm: parsed.data.widthMm,
        heightMm: parsed.data.heightMm,
        isDefault: parsed.data.isDefault,
        config: (parsed.data.config ?? {}) as unknown as Prisma.InputJsonValue,
        createdBy: ctx.userId,
      },
    });
  });

  await writeInventoryAudit(ctx, {
    action: "LABEL_TEMPLATE_CREATED",
    entityType: "InventoryLabelTemplate",
    entityId: created.id,
    after: created,
  });

  return created;
}

export async function updateLabelTemplate(ctx: InventoryRequestContext, id: string, input: unknown) {
  const parsed = labelTemplateSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid label template payload", parsed.error.flatten());
  }

  const existing = await prisma.inventoryLabelTemplate.findFirst({
    where: { id, companyId: ctx.companyId },
  });

  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Label template not found");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault && (parsed.data.paperType ?? existing.paperType)) {
      await tx.inventoryLabelTemplate.updateMany({
        where: {
          companyId: ctx.companyId,
          paperType: parsed.data.paperType ?? existing.paperType,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    return tx.inventoryLabelTemplate.update({
      where: { id },
      data: {
        ...parsed.data,
        config:
          parsed.data.config === undefined
            ? undefined
            : ((parsed.data.config ?? {}) as unknown as Prisma.InputJsonValue),
      },
    });
  });

  await writeInventoryAudit(ctx, {
    action: "LABEL_TEMPLATE_UPDATED",
    entityType: "InventoryLabelTemplate",
    entityId: id,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function deleteLabelTemplate(ctx: InventoryRequestContext, id: string) {
  const existing = await prisma.inventoryLabelTemplate.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) {
    throw new InventoryError("NOT_FOUND", "Label template not found");
  }

  await prisma.inventoryLabelTemplate.delete({ where: { id } });

  await writeInventoryAudit(ctx, {
    action: "LABEL_TEMPLATE_DELETED",
    entityType: "InventoryLabelTemplate",
    entityId: id,
    before: existing,
  });
}
