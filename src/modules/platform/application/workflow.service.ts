import { PlatformWorkflowDefinitionStatus, PlatformWorkflowInstanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry)).filter(Boolean);
}

function resolveTerminalStatus(toState: string): PlatformWorkflowInstanceStatus {
  const upper = toState.toUpperCase();
  if (upper.includes("REJECT")) return PlatformWorkflowInstanceStatus.REJECTED;
  if (upper.includes("CANCEL")) return PlatformWorkflowInstanceStatus.CANCELLED;
  if (upper.includes("APPROV")) return PlatformWorkflowInstanceStatus.APPROVED;
  return PlatformWorkflowInstanceStatus.COMPLETED;
}

export async function listWorkflowDefinitions(
  ctx: PlatformRequestContext,
  entityType?: string,
) {
  return prisma.workflowDefinition.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(entityType ? { entityType } : {}),
      OR: [{ companyId: ctx.companyId }, { companyId: null }],
    },
    orderBy: [{ entityType: "asc" }, { companyId: "desc" }, { version: "desc" }],
    include: {
      states: { orderBy: { sortOrder: "asc" } },
      transitions: true,
    },
  });
}

export async function upsertWorkflowDefinition(
  ctx: PlatformRequestContext,
  input: {
    companyId?: string;
    entityType: string;
    name: string;
    status: PlatformWorkflowDefinitionStatus;
    initialState: string;
    terminalStates: string[];
    states: Array<{ key: string; label: string; isInitial?: boolean; isTerminal?: boolean; sortOrder?: number }>;
    transitions: Array<{
      actionKey: string;
      fromState: string;
      toState: string;
      minApprovals: number;
      requiredPermissions: string[];
      conditions?: Record<string, unknown>;
    }>;
    config?: Record<string, unknown>;
  },
) {
  const companyId = input.companyId ?? ctx.companyId;

  const latest = await prisma.workflowDefinition.findFirst({
    where: {
      tenantId: ctx.tenantId,
      companyId,
      entityType: input.entityType,
    },
    orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
    select: { version: true },
  });

  const version = (latest?.version ?? 0) + 1;

  return prisma.$transaction(async (tx) => {
    if (input.status === PlatformWorkflowDefinitionStatus.ACTIVE) {
      await tx.workflowDefinition.updateMany({
        where: {
          tenantId: ctx.tenantId,
          companyId,
          entityType: input.entityType,
          status: PlatformWorkflowDefinitionStatus.ACTIVE,
        },
        data: { status: PlatformWorkflowDefinitionStatus.ARCHIVED, updatedBy: ctx.userId },
      });
    }

    return tx.workflowDefinition.create({
      data: {
        tenantId: ctx.tenantId,
        companyId,
        entityType: input.entityType,
        name: input.name,
        version,
        status: input.status,
        initialState: input.initialState,
        terminalStates: input.terminalStates as never,
        config: (input.config ?? {}) as never,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        states: {
          create: input.states.map((state, index) => ({
            key: state.key,
            label: state.label,
            isInitial: state.isInitial ?? state.key === input.initialState,
            isTerminal: state.isTerminal ?? input.terminalStates.includes(state.key),
            sortOrder: state.sortOrder ?? index,
          })),
        },
        transitions: {
          create: input.transitions.map((transition) => ({
            actionKey: transition.actionKey,
            fromState: transition.fromState,
            toState: transition.toState,
            minApprovals: transition.minApprovals,
            requiredPermissions: transition.requiredPermissions as never,
            conditions: (transition.conditions ?? null) as never,
          })),
        },
      },
      include: {
        states: true,
        transitions: true,
      },
    });
  });
}

export async function resolveActiveWorkflowDefinition(
  ctx: PlatformRequestContext,
  input: { entityType: string; companyId?: string | null },
) {
  const companyId = input.companyId ?? ctx.companyId;
  const definitions = await prisma.workflowDefinition.findMany({
    where: {
      tenantId: ctx.tenantId,
      entityType: input.entityType,
      status: PlatformWorkflowDefinitionStatus.ACTIVE,
      OR: [{ companyId }, { companyId: null }],
    },
    orderBy: [{ companyId: "desc" }, { version: "desc" }, { updatedAt: "desc" }],
    include: {
      transitions: true,
    },
    take: 5,
  });

  const byCompany = definitions.find((definition) => definition.companyId === companyId);
  const fallback = definitions.find((definition) => definition.companyId === null);

  return byCompany ?? fallback ?? null;
}

export async function findActiveWorkflowTransition(
  ctx: PlatformRequestContext,
  input: {
    entityType: string;
    companyId?: string | null;
    currentState: string;
    actionKey: string;
  },
) {
  const definition = await resolveActiveWorkflowDefinition(ctx, {
    entityType: input.entityType,
    companyId: input.companyId,
  });

  if (!definition) return null;

  const transition = definition.transitions.find(
    (candidate) =>
      candidate.actionKey === input.actionKey &&
      candidate.fromState === input.currentState,
  );

  if (!transition) return null;

  return {
    definition,
    transition,
  };
}

export async function startWorkflowInstance(
  ctx: PlatformRequestContext,
  input: {
    entityType: string;
    entityId: string;
    companyId?: string;
    context?: Record<string, unknown>;
  },
) {
  const definition = await resolveActiveWorkflowDefinition(ctx, {
    entityType: input.entityType,
    companyId: input.companyId,
  });

  if (!definition) {
    throw new PlatformError("NOT_FOUND", `No active workflow for entity '${input.entityType}'`);
  }

  const effectiveCompanyId = definition.companyId ?? ctx.companyId;

  return prisma.workflowInstance.upsert({
    where: {
      tenantId_companyId_entityType_entityId: {
        tenantId: ctx.tenantId,
        companyId: effectiveCompanyId,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      companyId: effectiveCompanyId,
      definitionId: definition.id,
      entityType: input.entityType,
      entityId: input.entityId,
      currentState: definition.initialState,
      status: PlatformWorkflowInstanceStatus.IN_PROGRESS,
      context: (input.context ?? null) as never,
      startedBy: ctx.userId,
    },
    update: {
      context: (input.context ?? null) as never,
    },
  });
}

export async function applyWorkflowAction(
  ctx: PlatformRequestContext,
  input: {
    instanceId: string;
    actionKey: string;
    comment?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: input.instanceId },
    include: {
      definition: {
        include: {
          transitions: true,
        },
      },
    },
  });

  if (!instance || instance.tenantId !== ctx.tenantId) {
    throw new PlatformError("NOT_FOUND", "Workflow instance not found");
  }

  const transition = instance.definition.transitions.find(
    (candidate) =>
      candidate.actionKey === input.actionKey &&
      candidate.fromState === instance.currentState,
  );

  if (!transition) {
    throw new PlatformError("CONFLICT", `Action '${input.actionKey}' is not allowed from '${instance.currentState}'`);
  }

  const requiredPermissions = parseStringArray(transition.requiredPermissions);
  const missing = requiredPermissions.find((permission) => !ctx.permissions.includes(permission));
  if (missing && ctx.platformRole !== "SUPER_ADMIN") {
    throw new PlatformError("FORBIDDEN", `Missing workflow permission: ${missing}`);
  }

  const terminalStates = parseStringArray(instance.definition.terminalStates);
  const isTerminal = terminalStates.includes(transition.toState);
  const nextStatus = isTerminal ? resolveTerminalStatus(transition.toState) : PlatformWorkflowInstanceStatus.IN_PROGRESS;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.workflowInstance.update({
      where: { id: instance.id },
      data: {
        currentState: transition.toState,
        status: nextStatus,
        completedBy: isTerminal ? ctx.userId : null,
        completedAt: isTerminal ? new Date() : null,
      },
    });

    const action = await tx.workflowAction.create({
      data: {
        instanceId: instance.id,
        transitionId: transition.id,
        actionKey: input.actionKey,
        fromState: transition.fromState,
        toState: transition.toState,
        actedBy: ctx.userId,
        comment: input.comment ?? null,
        metadata: (input.metadata ?? null) as never,
      },
    });

    return { updated, action };
  });
}
