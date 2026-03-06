import {
  AiFeedbackType,
  AiRecommendationStatus,
  AiResolutionDraftStatus,
  AuditEventOrigin,
  OpsActionExecutionStatus,
  OpsExceptionStatus,
  OpsExceptionSeverity,
  OpsTaskStatus,
  OpsTaskPriority,
  type Prisma,
} from "@prisma/client";
import type {
  ActionRecommendation,
  AiFeedbackEvent,
  CopilotResolutionDraft,
  OpsInboxItem,
  OperationalKpiSnapshot,
  WorkflowActionCommand,
} from "@/lib/api/contracts";
import { prisma } from "@/lib/prisma";
import { appendAuditEvent, stableStringify } from "@/modules/platform/application/audit-ledger.service";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

type InboxQuery = {
  page: number;
  limit: number;
  status?: string;
  priority?: string;
};

type RecommendationQuery = {
  page: number;
  limit: number;
  role?: string;
  status?: string;
};

type ExecuteActionInput = {
  contextType: string;
  contextRef?: string;
  notes?: string;
  expectedState?: string;
  metadata?: Record<string, unknown>;
};

type CopilotResolveInput = {
  contextType: string;
  contextRef: string;
  problemSummary: string;
  constraints: string[];
  requestedActionId?: string;
  metadata?: Record<string, unknown>;
};

type FeedbackInput = {
  recommendationId?: string;
  draftId?: string;
  feedbackType: AiFeedbackType;
  reason?: string;
  signal?: Record<string, unknown>;
};

function normalizeEnumValue(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function parseOpsTaskStatus(value?: string): OpsTaskStatus | undefined {
  if (!value) return undefined;
  const normalized = normalizeEnumValue(value);
  if (normalized === OpsTaskStatus.OPEN) return OpsTaskStatus.OPEN;
  if (normalized === OpsTaskStatus.IN_PROGRESS) return OpsTaskStatus.IN_PROGRESS;
  if (normalized === OpsTaskStatus.BLOCKED) return OpsTaskStatus.BLOCKED;
  if (normalized === OpsTaskStatus.DONE) return OpsTaskStatus.DONE;
  if (normalized === OpsTaskStatus.ARCHIVED) return OpsTaskStatus.ARCHIVED;
  return undefined;
}

function parseOpsExceptionStatus(value?: string): OpsExceptionStatus | undefined {
  if (!value) return undefined;
  const normalized = normalizeEnumValue(value);
  if (normalized === OpsExceptionStatus.OPEN) return OpsExceptionStatus.OPEN;
  if (normalized === OpsExceptionStatus.ACKNOWLEDGED) return OpsExceptionStatus.ACKNOWLEDGED;
  if (normalized === OpsExceptionStatus.RESOLVED) return OpsExceptionStatus.RESOLVED;
  if (normalized === OpsExceptionStatus.DISMISSED) return OpsExceptionStatus.DISMISSED;
  return undefined;
}

function parseOpsTaskPriority(value?: string): OpsTaskPriority | undefined {
  if (!value) return undefined;
  const normalized = normalizeEnumValue(value);
  if (normalized === OpsTaskPriority.LOW) return OpsTaskPriority.LOW;
  if (normalized === OpsTaskPriority.MEDIUM) return OpsTaskPriority.MEDIUM;
  if (normalized === OpsTaskPriority.HIGH) return OpsTaskPriority.HIGH;
  if (normalized === OpsTaskPriority.CRITICAL) return OpsTaskPriority.CRITICAL;
  return undefined;
}

function parseOpsExceptionSeverity(value?: string): OpsExceptionSeverity | undefined {
  if (!value) return undefined;
  const normalized = normalizeEnumValue(value);
  if (normalized === OpsExceptionSeverity.LOW) return OpsExceptionSeverity.LOW;
  if (normalized === OpsExceptionSeverity.MEDIUM) return OpsExceptionSeverity.MEDIUM;
  if (normalized === OpsExceptionSeverity.HIGH) return OpsExceptionSeverity.HIGH;
  if (normalized === OpsExceptionSeverity.CRITICAL) return OpsExceptionSeverity.CRITICAL;
  return undefined;
}

function normalizeJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }
  if (typeof value === "object") {
    const inputRecord = value as Record<string, unknown>;
    const outputRecord: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, item] of Object.entries(inputRecord)) {
      if (item === undefined) continue;
      outputRecord[key] = normalizeJsonValue(item);
    }
    return outputRecord;
  }
  return String(value);
}

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  const normalized = normalizeJsonValue(value);
  if (normalized === null) {
    throw new PlatformError("VALIDATION_ERROR", "Top-level JSON null is not supported for this operation");
  }
  return normalized;
}

function scorePriority(priority: string): number {
  if (priority === OpsTaskPriority.CRITICAL) return 4;
  if (priority === OpsTaskPriority.HIGH) return 3;
  if (priority === OpsTaskPriority.MEDIUM) return 2;
  return 1;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function parseWorkflowActionResponse(
  status: OpsActionExecutionStatus,
  output: Prisma.JsonValue | null,
  reversibleState: Prisma.JsonValue | null,
): WorkflowActionCommand {
  const parsedOutput =
    output && typeof output === "object" && !Array.isArray(output)
      ? (output as Record<string, unknown>)
      : {};
  const parsedReversibleState =
    reversibleState && typeof reversibleState === "object" && !Array.isArray(reversibleState)
      ? (reversibleState as Record<string, unknown>)
      : {};

  return {
    actionId: String(parsedOutput.actionId ?? ""),
    commandKey: String(parsedOutput.commandKey ?? ""),
    idempotencyKey: String(parsedOutput.idempotencyKey ?? ""),
    status:
      status === OpsActionExecutionStatus.SUCCEEDED
        ? "SUCCEEDED"
        : status === OpsActionExecutionStatus.FAILED
          ? "FAILED"
          : status === OpsActionExecutionStatus.REPLAYED
            ? "REPLAYED"
            : "PENDING",
    reversibleState: {
      revertActionId: String(parsedReversibleState.revertActionId ?? ""),
      beforeState:
        parsedReversibleState.beforeState == null ? null : String(parsedReversibleState.beforeState),
      afterState:
        parsedReversibleState.afterState == null ? null : String(parsedReversibleState.afterState),
      rollbackReady: Boolean(parsedReversibleState.rollbackReady),
    },
    executedAt: String(parsedOutput.executedAt ?? new Date().toISOString()),
    result:
      parsedOutput.result && typeof parsedOutput.result === "object" && !Array.isArray(parsedOutput.result)
        ? (parsedOutput.result as Record<string, unknown>)
        : {},
  };
}

export async function listOpsInbox(
  ctx: PlatformRequestContext,
  query: InboxQuery,
): Promise<{
  rows: OpsInboxItem[];
  page: number;
  limit: number;
  total: number;
  summary: { openTasks: number; openExceptions: number };
}> {
  const taskStatus = parseOpsTaskStatus(query.status);
  const exceptionStatus = parseOpsExceptionStatus(query.status);
  if (query.status && !taskStatus && !exceptionStatus) {
    throw new PlatformError("VALIDATION_ERROR", `Unsupported status filter: ${query.status}`);
  }

  const taskPriority = parseOpsTaskPriority(query.priority);
  const exceptionSeverity = parseOpsExceptionSeverity(query.priority);
  if (query.priority && !taskPriority && !exceptionSeverity) {
    throw new PlatformError("VALIDATION_ERROR", `Unsupported priority filter: ${query.priority}`);
  }

  const taskWhere: Prisma.OpsTaskWhereInput = {
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    ...(query.status
      ? taskStatus
        ? { status: taskStatus }
        : { id: "__no_task_match_for_exception_status_filter__" }
      : { status: { in: [OpsTaskStatus.OPEN, OpsTaskStatus.IN_PROGRESS, OpsTaskStatus.BLOCKED] } }),
    ...(query.priority ? (taskPriority ? { priority: taskPriority } : { id: "__no_task_match_for_severity_filter__" }) : {}),
  };

  const exceptionWhere: Prisma.OpsExceptionWhereInput = {
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    ...(query.status
      ? exceptionStatus
        ? { status: exceptionStatus }
        : { id: "__no_exception_match_for_task_status_filter__" }
      : { status: { in: [OpsExceptionStatus.OPEN, OpsExceptionStatus.ACKNOWLEDGED] } }),
    ...(query.priority
      ? exceptionSeverity
        ? { severity: exceptionSeverity }
        : { id: "__no_exception_match_for_priority_filter__" }
      : {}),
  };

  const [tasks, exceptions, openTasks, openExceptions] = await Promise.all([
    prisma.opsTask.findMany({
      where: taskWhere,
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.opsException.findMany({
      where: exceptionWhere,
      orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
      take: 300,
    }),
    prisma.opsTask.count({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
      },
    }),
    prisma.opsException.count({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
    }),
  ]);

  const taskItems: OpsInboxItem[] = tasks.map((task) => ({
    id: task.id,
    itemType: "TASK",
    title: task.title,
    summary: task.summary,
    priority: task.priority,
    status: task.status,
    dueAt: toIso(task.dueAt),
    sourceType: task.sourceType,
    sourceId: task.sourceId,
    assigneeUserId: task.assigneeUserId,
    metadata: task.metadata,
    createdAt: task.createdAt.toISOString(),
  }));

  const exceptionItems: OpsInboxItem[] = exceptions.map((entry) => ({
    id: entry.id,
    itemType: "EXCEPTION",
    title: entry.summary,
    summary: entry.kind,
    priority:
      entry.severity === OpsExceptionSeverity.CRITICAL
        ? "CRITICAL"
        : entry.severity === OpsExceptionSeverity.HIGH
          ? "HIGH"
          : entry.severity === OpsExceptionSeverity.MEDIUM
            ? "MEDIUM"
            : "LOW",
    status: entry.status,
    dueAt: null,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    assigneeUserId: null,
    metadata: {
      severity: entry.severity,
      detectedAt: entry.detectedAt.toISOString(),
      details: entry.details,
    },
    createdAt: entry.createdAt.toISOString(),
  }));

  const merged = [...taskItems, ...exceptionItems].sort((a, b) => {
    const priorityDiff = scorePriority(b.priority) - scorePriority(a.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const start = (query.page - 1) * query.limit;
  const end = start + query.limit;

  return {
    rows: merged.slice(start, end),
    page: query.page,
    limit: query.limit,
    total: merged.length,
    summary: {
      openTasks,
      openExceptions,
    },
  };
}

export async function listActionRecommendations(
  ctx: PlatformRequestContext,
  query: RecommendationQuery,
): Promise<{
  rows: ActionRecommendation[];
  page: number;
  limit: number;
  total: number;
}> {
  const where: Prisma.AiRecommendationWhereInput = {
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status as AiRecommendationStatus } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.aiRecommendation.findMany({
      where,
      orderBy: [{ score: "desc" }, { confidence: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.aiRecommendation.count({ where }),
  ]);

  return {
    rows: rows.map((item) => ({
      id: item.id,
      actionId: item.actionId,
      actionLabel: item.actionLabel,
      role: item.role,
      score: item.score,
      confidence: item.confidence,
      rationale: item.rationale,
      status: item.status,
      contextType: item.contextType,
      contextRef: item.contextRef,
      createdAt: item.createdAt.toISOString(),
    })),
    page: query.page,
    limit: query.limit,
    total,
  };
}

export async function executeWorkflowActionCommand(
  ctx: PlatformRequestContext,
  actionId: string,
  payload: ExecuteActionInput,
  idempotencyKey: string,
): Promise<WorkflowActionCommand> {
  const normalizedActionId = actionId.trim();
  if (!normalizedActionId) {
    throw new PlatformError("VALIDATION_ERROR", "actionId is required");
  }
  const normalizedIdempotencyKey = idempotencyKey.trim();
  if (!normalizedIdempotencyKey) {
    throw new PlatformError("VALIDATION_ERROR", "Idempotency key is required");
  }

  const commandKey = `ops.${normalizedActionId}`;
  const requestFingerprint = stableStringify({
    actionId: normalizedActionId,
    commandKey,
    payload,
  });

  const existing = await prisma.opsActionExecution.findUnique({
    where: {
      tenantId_companyId_idempotencyKey: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        idempotencyKey: normalizedIdempotencyKey,
      },
    },
  });

  if (existing) {
    const existingInput =
      existing.input && typeof existing.input === "object" && !Array.isArray(existing.input)
        ? (existing.input as Record<string, unknown>)
        : {};
    const existingFingerprint =
      typeof existingInput.requestFingerprint === "string" ? existingInput.requestFingerprint : null;

    if (existing.actionId !== normalizedActionId || existingFingerprint !== requestFingerprint) {
      throw new PlatformError("CONFLICT", "Idempotency key cannot be reused with a different command payload");
    }

    const replay = parseWorkflowActionResponse(
      OpsActionExecutionStatus.REPLAYED,
      existing.output,
      existing.reversibleState,
    );
    replay.actionId = normalizedActionId;
    replay.commandKey = commandKey;
    replay.idempotencyKey = normalizedIdempotencyKey;
    return replay;
  }

  const created = await prisma.opsActionExecution.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actionId: normalizedActionId,
      commandKey,
      idempotencyKey: normalizedIdempotencyKey,
      requestId: ctx.requestId,
      actorUserId: ctx.userId,
      input: toPrismaJsonValue({
        ...payload,
        requestFingerprint,
      }),
      status: OpsActionExecutionStatus.PENDING,
    },
  });

  const reversibleState = {
    revertActionId: `${normalizedActionId}:rollback`,
    beforeState: payload.contextRef ?? null,
    afterState: payload.expectedState ?? null,
    rollbackReady: true,
  };

  const output = {
    actionId: normalizedActionId,
    commandKey,
    idempotencyKey: normalizedIdempotencyKey,
    executedAt: new Date().toISOString(),
    result: {
      accepted: true,
      executionId: created.id,
      contextType: payload.contextType,
      contextRef: payload.contextRef ?? null,
    },
  };

  const saved = await prisma.opsActionExecution.update({
    where: { id: created.id },
    data: {
      status: OpsActionExecutionStatus.SUCCEEDED,
      output: toPrismaJsonValue(output),
      reversibleState: toPrismaJsonValue(reversibleState),
    },
  });

  await appendAuditEvent(ctx, {
    source: "ops.action",
    action: "EXECUTE",
    entityType: "OpsActionExecution",
    entityId: saved.id,
    after: output,
    metadata: {
      commandKey,
      idempotencyKey: normalizedIdempotencyKey,
    },
    origin: AuditEventOrigin.HUMAN,
    decisionTrace: {
      mode: "deterministic-command",
      requestFingerprint,
      reversibleState,
    },
  });

  const mapped = parseWorkflowActionResponse(saved.status, saved.output, saved.reversibleState);
  mapped.actionId = normalizedActionId;
  mapped.commandKey = commandKey;
  mapped.idempotencyKey = normalizedIdempotencyKey;
  return mapped;
}

export async function createCopilotResolutionDraft(
  ctx: PlatformRequestContext,
  payload: CopilotResolveInput,
): Promise<CopilotResolutionDraft> {
  const confidenceBase = Math.min(0.98, 0.55 + payload.problemSummary.length / 2000);
  const confidence = Number(confidenceBase.toFixed(2));
  const actionId = payload.requestedActionId ?? "ops.resolve";

  const draftText = [
    `Detected issue in ${payload.contextType}:${payload.contextRef}.`,
    `Proposed action: ${actionId}.`,
    payload.constraints.length > 0
      ? `Constraints considered: ${payload.constraints.join(", ")}.`
      : "No explicit constraints were supplied.",
    "Suggested sequence: validate scope, execute command, verify post-state, and notify owner.",
  ].join(" ");

  const draft = await prisma.aiResolutionDraft.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      contextType: payload.contextType,
      contextRef: payload.contextRef,
      draftText,
      confidence,
      sourceSignals: toPrismaJsonValue({
        problemSummary: payload.problemSummary,
        constraints: payload.constraints,
        metadata: payload.metadata ?? {},
      }),
      expectedImpact: toPrismaJsonValue({
        cycleTimeImprovementPct: 12,
        riskReductionLevel: "MEDIUM",
      }),
      rollbackPlan: toPrismaJsonValue({
        revertActionId: `${actionId}:rollback`,
        preconditions: ["idempotency-key-retained", "scope-verified"],
      }),
      status: AiResolutionDraftStatus.DRAFT,
      createdBy: ctx.userId,
    },
  });

  await prisma.aiRecommendation.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      role: ctx.role,
      contextType: payload.contextType,
      contextRef: payload.contextRef,
      score: Number((confidence * 100).toFixed(2)),
      confidence,
      rationale: toPrismaJsonValue({
        draftId: draft.id,
        summary: payload.problemSummary,
      }),
      actionId,
      actionLabel: `Resolve ${payload.contextType}`,
      status: AiRecommendationStatus.ACTIVE,
    },
  });

  await appendAuditEvent(ctx, {
    source: "ai.copilot",
    action: "RESOLVE_DRAFT_CREATED",
    entityType: "AiResolutionDraft",
    entityId: draft.id,
    after: {
      confidence,
      contextType: payload.contextType,
      contextRef: payload.contextRef,
    },
    metadata: {
      requestedActionId: payload.requestedActionId ?? null,
    },
    origin: AuditEventOrigin.AI,
    decisionTrace: {
      constraints: payload.constraints,
      confidence,
    },
  });

  return {
    id: draft.id,
    contextType: draft.contextType,
    contextRef: draft.contextRef,
    draftText: draft.draftText,
    confidence: draft.confidence,
    sourceSignals: draft.sourceSignals,
    expectedImpact: draft.expectedImpact,
    rollbackPlan: draft.rollbackPlan,
    status: draft.status,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  };
}

export async function submitAiFeedback(
  ctx: PlatformRequestContext,
  payload: FeedbackInput,
): Promise<AiFeedbackEvent> {
  if (!payload.recommendationId && !payload.draftId) {
    throw new PlatformError("VALIDATION_ERROR", "Either recommendationId or draftId is required");
  }

  const event = await prisma.aiFeedbackEvent.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      recommendationId: payload.recommendationId ?? null,
      draftId: payload.draftId ?? null,
      actorUserId: ctx.userId,
      feedbackType: payload.feedbackType,
      reason: payload.reason ?? null,
      signal: toPrismaJsonValue(payload.signal ?? {}),
      requestId: ctx.requestId,
    },
  });

  if (payload.recommendationId) {
    await prisma.aiRecommendation.updateMany({
      where: {
        id: payload.recommendationId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
      data: {
        status:
          payload.feedbackType === AiFeedbackType.ACCEPT
            ? AiRecommendationStatus.APPLIED
            : payload.feedbackType === AiFeedbackType.REJECT
              ? AiRecommendationStatus.DISMISSED
              : AiRecommendationStatus.ACTIVE,
      },
    });
  }

  if (payload.draftId) {
    await prisma.aiResolutionDraft.updateMany({
      where: {
        id: payload.draftId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
      data: {
        status:
          payload.feedbackType === AiFeedbackType.ACCEPT
            ? AiResolutionDraftStatus.APPLIED
            : payload.feedbackType === AiFeedbackType.REJECT
              ? AiResolutionDraftStatus.DISCARDED
              : AiResolutionDraftStatus.DRAFT,
      },
    });
  }

  await appendAuditEvent(ctx, {
    source: "ai.feedback",
    action: "SUBMIT",
    entityType: "AiFeedbackEvent",
    entityId: event.id,
    metadata: {
      recommendationId: payload.recommendationId ?? null,
      draftId: payload.draftId ?? null,
      feedbackType: payload.feedbackType,
    },
    origin: AuditEventOrigin.HUMAN,
    decisionTrace: {
      reason: payload.reason ?? null,
      signal: payload.signal ?? {},
    },
  });

  return {
    id: event.id,
    recommendationId: event.recommendationId,
    draftId: event.draftId,
    feedbackType: event.feedbackType,
    reason: event.reason,
    signal: event.signal,
    requestId: event.requestId,
    createdAt: event.createdAt.toISOString(),
  };
}

export async function getOperationalKpiSnapshot(
  ctx: PlatformRequestContext,
  input: { windowDays: number },
): Promise<OperationalKpiSnapshot> {
  const since = new Date(Date.now() - input.windowDays * 24 * 60 * 60 * 1000);

  const [openTaskCount, openExceptionCount, totalExecutions, successfulExecutions, aiFeedbackCount] =
    await Promise.all([
      prisma.opsTask.count({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
        },
      }),
      prisma.opsException.count({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
      }),
      prisma.opsActionExecution.count({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          createdAt: { gte: since },
        },
      }),
      prisma.opsActionExecution.count({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          createdAt: { gte: since },
          status: { in: [OpsActionExecutionStatus.SUCCEEDED, OpsActionExecutionStatus.REPLAYED] },
        },
      }),
      prisma.aiFeedbackEvent.count({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          createdAt: { gte: since },
        },
      }),
    ]);

  const actionSuccessRatePct =
    totalExecutions === 0 ? 0 : Number(((successfulExecutions / totalExecutions) * 100).toFixed(2));
  const aiAdoptionPct =
    totalExecutions === 0 ? 0 : Number(((aiFeedbackCount / totalExecutions) * 100).toFixed(2));

  return {
    windowDays: input.windowDays,
    taskOpenCount: openTaskCount,
    exceptionOpenCount: openExceptionCount,
    actionExecutionCount: totalExecutions,
    actionSuccessRatePct,
    aiAdoptionPct,
    updatedAt: new Date().toISOString(),
  };
}
