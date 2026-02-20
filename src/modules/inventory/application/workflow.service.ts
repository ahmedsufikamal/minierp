import { InventoryDocumentType, PlatformWorkflowDefinitionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { workflowDefinitionSchema } from "@/modules/inventory/application/schemas";
import { InventoryError } from "@/modules/inventory/domain/errors";
import { defaultWorkflowConfig, findTransition, workflowConfigSchema } from "@/modules/inventory/domain/workflow";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";
import {
  findActiveWorkflowTransition,
  upsertWorkflowDefinition as upsertPlatformWorkflowDefinition,
} from "@/modules/platform/application/workflow.service";

function toPlatformCtx(ctx: InventoryRequestContext) {
  return {
    requestId: ctx.requestId,
    tenantId: ctx.tenantId ?? ctx.companyId,
    companyId: ctx.companyId,
    userId: ctx.userId,
    role: ctx.role,
    platformRole: "NONE" as const,
    permissions: ctx.iamPermissions ?? [],
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  };
}

function toPlatformEntityType(documentType: InventoryDocumentType): string {
  return `inventory.document.${documentType.toLowerCase()}`;
}

function parseRequiredPermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry)).filter(Boolean);
}

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

  await upsertPlatformWorkflowDefinition(toPlatformCtx(ctx), {
    companyId: ctx.companyId,
    entityType: toPlatformEntityType(parsed.data.documentType),
    name: parsed.data.name,
    status: parsed.data.isActive ? PlatformWorkflowDefinitionStatus.ACTIVE : PlatformWorkflowDefinitionStatus.DRAFT,
    initialState: parsed.data.config.initialStatus,
    terminalStates: parsed.data.config.terminalStatuses,
    states: Array.from(
      new Set([
        parsed.data.config.initialStatus,
        ...parsed.data.config.terminalStatuses,
        ...parsed.data.config.transitions.flatMap((transition) => [...transition.from, transition.to]),
      ]),
    ).map((state, index) => ({
      key: state,
      label: state,
      isInitial: state === parsed.data.config.initialStatus,
      isTerminal: parsed.data.config.terminalStatuses.includes(state),
      sortOrder: index,
    })),
    transitions: parsed.data.config.transitions.flatMap((transition) =>
      transition.from.map((fromState) => ({
        actionKey: transition.action,
        fromState,
        toState: transition.to,
        minApprovals: transition.minApprovals,
        requiredPermissions: transition.requiredPermissions,
        conditions:
          transition.thresholdAmountMinor != null
            ? {
                thresholdAmountMinor: transition.thresholdAmountMinor,
              }
            : undefined,
      })),
    ),
    config: parsed.data.config as unknown as Record<string, unknown>,
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
  const platformTransition = await findActiveWorkflowTransition(toPlatformCtx(ctx), {
    entityType: toPlatformEntityType(params.documentType),
    companyId: ctx.companyId,
    currentState: params.currentStatus,
    actionKey: params.action,
  });

  if (platformTransition) {
    return {
      action: params.action,
      from: [platformTransition.transition.fromState],
      to: platformTransition.transition.toState,
      requiredPermissions: parseRequiredPermissions(platformTransition.transition.requiredPermissions),
      minApprovals: platformTransition.transition.minApprovals,
      thresholdAmountMinor: undefined,
    };
  }

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
