import { InventoryDocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { workflowDefinitionSchema } from "@/modules/inventory/application/schemas";
import { InventoryError } from "@/modules/inventory/domain/errors";
import { defaultWorkflowConfig, findTransition, workflowConfigSchema } from "@/modules/inventory/domain/workflow";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";

export async function listWorkflowDefinitions(ctx: InventoryRequestContext) {
  return prisma.inventoryWorkflowDefinition.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ documentType: "asc" }, { isActive: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getActiveWorkflowForType(ctx: InventoryRequestContext, documentType: InventoryDocumentType) {
  const existing = await prisma.inventoryWorkflowDefinition.findFirst({
    where: {
      companyId: ctx.companyId,
      documentType,
      isActive: true,
    },
    orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
  });

  if (existing) {
    const parsed = workflowConfigSchema.safeParse(existing.config);
    if (!parsed.success) {
      throw new InventoryError("CONFLICT", "Stored workflow config is invalid", parsed.error.flatten());
    }
    return { id: existing.id, config: parsed.data, version: existing.version };
  }

  return {
    id: null,
    config: defaultWorkflowConfig(),
    version: 1,
  };
}

export async function upsertWorkflowDefinition(ctx: InventoryRequestContext, input: unknown) {
  const parsed = workflowDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid workflow payload", parsed.error.flatten());
  }

  const active = await prisma.inventoryWorkflowDefinition.findFirst({
    where: {
      companyId: ctx.companyId,
      documentType: parsed.data.documentType,
      isActive: true,
    },
    orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
  });

  const nextVersion = (active?.version ?? 0) + 1;

  const created = await prisma.$transaction(async (tx) => {
    if (active) {
      await tx.inventoryWorkflowDefinition.update({
        where: { id: active.id },
        data: { isActive: false, updatedBy: ctx.userId },
      });
    }

    return tx.inventoryWorkflowDefinition.create({
      data: {
        companyId: ctx.companyId,
        documentType: parsed.data.documentType,
        name: parsed.data.name,
        version: nextVersion,
        isActive: parsed.data.isActive,
        config: parsed.data.config,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
  });

  await writeInventoryAudit(ctx, {
    action: "WORKFLOW_UPDATED",
    entityType: "InventoryWorkflowDefinition",
    entityId: created.id,
    before: active,
    after: created,
  });

  return created;
}

export async function resolveWorkflowTransition(
  ctx: InventoryRequestContext,
  params: {
    documentType: InventoryDocumentType;
    currentStatus: string;
    action: "SUBMIT" | "APPROVE" | "REJECT" | "CANCEL" | "POST";
    totalValueMinor: number;
  },
) {
  const workflow = await getActiveWorkflowForType(ctx, params.documentType);
  const transition = findTransition(workflow.config, params.action, params.currentStatus, params.totalValueMinor);
  if (!transition) {
    throw new InventoryError(
      "CONFLICT",
      `Action '${params.action}' is not allowed from status '${params.currentStatus}'`,
    );
  }
  return transition;
}
