import crypto from "node:crypto";
import {
  AutomationActionType,
  AutomationRule,
  AutomationRuleRun,
  AutomationRuleRunStatus,
  Prisma,
  TaskPriority,
} from "@prisma/client";
import {
  getAutomationWebhookAllowlistOrigins,
  getAutomationWebhookMaxAttempts,
  getAutomationWebhookSigningSecret,
  getAutomationWebhookTimeoutMs,
} from "@/lib/runtime-env";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { automationRunCreateSchema, automationRunListQuerySchema } from "@/modules/platform/domain/schemas";
import {
  appendAuditEvent,
  enqueueOutboxEvent,
  stableStringify,
} from "@/modules/platform/application/audit-ledger.service";

type AutomationRunInput = {
  automationRuleId?: string | null;
  entityType: string;
  entityId?: string | null;
  trigger: "ON_CREATE" | "ON_SUBMIT" | "ON_STATUS_CHANGE";
  idempotencyKey?: string | null;
  input?: Record<string, unknown>;
};

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertRuleScope(ctx: PlatformRequestContext, rule: Pick<AutomationRule, "tenantId" | "companyId">): void {
  if (rule.tenantId !== ctx.tenantId) {
    throw new PlatformError("NOT_FOUND", "Automation rule not found");
  }
  if (ctx.platformRole === "SUPER_ADMIN") return;
  if (rule.companyId && rule.companyId === ctx.companyId) return;
  throw new PlatformError("FORBIDDEN", "Cannot execute automation rule for another company scope");
}

function matchesCondition(condition: unknown, runInput: Record<string, unknown>): boolean {
  if (!condition || typeof condition !== "object") return true;
  return Object.entries(condition as Record<string, unknown>).every(([key, value]) => runInput[key] === value);
}

function normalizeEntityType(value: string): string {
  return value.trim().toLowerCase().replace(/[-_\s]+/g, "");
}

function assertAllowedField(field: string, allowed: string[]): void {
  if (!allowed.includes(field)) {
    throw new PlatformError("VALIDATION_ERROR", `Unsupported field for SET_FIELD action: ${field}`);
  }
}

async function applySetFieldAction(
  ctx: PlatformRequestContext,
  run: AutomationRuleRun,
  actionConfig: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const entityType = String(actionConfig.entityType ?? run.entityType ?? "").trim();
  const entityId = String(actionConfig.entityId ?? run.entityId ?? "").trim();
  const field = String(actionConfig.field ?? "").trim();
  const value = actionConfig.value;

  if (!entityType || !entityId || !field) {
    throw new PlatformError("VALIDATION_ERROR", "SET_FIELD requires entityType/entityId/field");
  }

  const normalized = normalizeEntityType(entityType);

  if (normalized === "project") {
    const allowed = ["name", "notes", "status", "startDate", "endDate"];
    assertAllowedField(field, allowed);
    const existing = await prisma.project.findFirst({
      where: { id: entityId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!existing) {
      throw new PlatformError("NOT_FOUND", "Project not found for SET_FIELD");
    }
    const row = await prisma.project.update({
      where: { id: existing.id },
      data: {
        [field]: value,
        updatedBy: ctx.userId,
      } as Prisma.ProjectUpdateInput,
      select: { id: true, name: true, status: true },
    });
    return { model: "Project", row };
  }

  if (normalized === "projecttask" || normalized === "task") {
    const allowed = ["title", "description", "status", "assignedTo", "dueDate", "plannedMins", "billable"];
    assertAllowedField(field, allowed);
    const existing = await prisma.projectTask.findFirst({
      where: { id: entityId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!existing) {
      throw new PlatformError("NOT_FOUND", "Project task not found for SET_FIELD");
    }
    const row = await prisma.projectTask.update({
      where: { id: existing.id },
      data: {
        [field]: value,
        updatedBy: ctx.userId,
      } as Prisma.ProjectTaskUpdateInput,
      select: { id: true, title: true, status: true },
    });
    return { model: "ProjectTask", row };
  }

  if (normalized === "ticket") {
    const allowed = ["subject", "description", "status", "priority", "assignedTo", "dueAt"];
    assertAllowedField(field, allowed);
    const existing = await prisma.ticket.findFirst({
      where: { id: entityId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!existing) {
      throw new PlatformError("NOT_FOUND", "Ticket not found for SET_FIELD");
    }
    const row = await prisma.ticket.update({
      where: { id: existing.id },
      data: {
        [field]: value,
        updatedBy: ctx.userId,
      } as Prisma.TicketUpdateInput,
      select: { id: true, number: true, status: true },
    });
    return { model: "Ticket", row };
  }

  if (normalized === "qualitygoal" || normalized === "goal") {
    const allowed = ["name", "description", "status", "currentValue", "dueDate", "ownerRef"];
    assertAllowedField(field, allowed);
    const existing = await prisma.qualityGoal.findFirst({
      where: { id: entityId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!existing) {
      throw new PlatformError("NOT_FOUND", "Quality goal not found for SET_FIELD");
    }
    const nextValue =
      field === "currentValue" && typeof value === "number" ? new Prisma.Decimal(value) : value;
    const row = await prisma.qualityGoal.update({
      where: { id: existing.id },
      data: {
        [field]: nextValue,
        updatedBy: ctx.userId,
      } as Prisma.QualityGoalUpdateInput,
      select: { id: true, key: true, status: true },
    });
    return { model: "QualityGoal", row };
  }

  throw new PlatformError("VALIDATION_ERROR", `Unsupported SET_FIELD entityType: ${entityType}`);
}

async function applyCreateTaskAction(
  ctx: PlatformRequestContext,
  run: AutomationRuleRun,
  actionConfig: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const normalized = normalizeEntityType(run.entityType);
  const inferredProjectId = normalized === "project" ? run.entityId : null;

  const projectId = String(actionConfig.projectId ?? inferredProjectId ?? "").trim();
  const title = String(actionConfig.title ?? "").trim();

  if (!projectId || !title) {
    throw new PlatformError("VALIDATION_ERROR", "CREATE_TASK requires projectId and title");
  }

  await prisma.project.findFirstOrThrow({
    where: { id: projectId, companyId: ctx.companyId },
    select: { id: true },
  });

  const task = await prisma.projectTask.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      projectId,
      title,
      description: actionConfig.description ? String(actionConfig.description) : null,
      priority: (actionConfig.priority as TaskPriority) ?? TaskPriority.MEDIUM,
      assignedTo: actionConfig.assignedTo ? String(actionConfig.assignedTo) : null,
      dueDate: actionConfig.dueDate ? new Date(String(actionConfig.dueDate)) : null,
      plannedMins:
        actionConfig.plannedMins !== undefined && actionConfig.plannedMins !== null
          ? Number(actionConfig.plannedMins)
          : null,
      billable: actionConfig.billable === undefined ? true : Boolean(actionConfig.billable),
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    select: {
      id: true,
      projectId: true,
      title: true,
      status: true,
    },
  });

  return { model: "ProjectTask", row: task };
}

async function applySendNotificationAction(
  ctx: PlatformRequestContext,
  run: AutomationRuleRun,
  actionConfig: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const recipients = Array.isArray(actionConfig.recipients)
    ? actionConfig.recipients.map((value) => String(value).trim()).filter(Boolean)
    : [];

  if (recipients.length === 0) {
    throw new PlatformError("VALIDATION_ERROR", "SEND_NOTIFICATION requires recipients[]");
  }

  const channel = String(actionConfig.channel ?? "IN_APP").trim().toUpperCase();
  const subject = String(actionConfig.subject ?? "Automation notification").trim();
  const body = String(actionConfig.body ?? "").trim();

  const outbox = await enqueueOutboxEvent(ctx, {
    topic: "platform.automation.notification",
    aggregateType: "AutomationRuleRun",
    aggregateId: run.id,
    payload: {
      runId: run.id,
      automationRuleId: run.automationRuleId,
      entityType: run.entityType,
      entityId: run.entityId,
      channel,
      recipients,
      subject,
      body,
    },
  });

  return {
    channel,
    recipients,
    outboxEventId: outbox.id,
  };
}

function normalizeAllowedOrigins(allowed: string[]): Set<string> {
  return new Set(allowed.map((origin) => origin.toLowerCase()));
}

async function callWebhook(
  run: AutomationRuleRun,
  actionConfig: Record<string, unknown>,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const urlRaw = String(actionConfig.url ?? "").trim();
  if (!urlRaw) {
    throw new PlatformError("VALIDATION_ERROR", "CALL_WEBHOOK requires actionConfig.url");
  }

  let url: URL;
  try {
    url = new URL(urlRaw);
  } catch {
    throw new PlatformError("VALIDATION_ERROR", "Invalid webhook URL");
  }

  const allowlist = normalizeAllowedOrigins(getAutomationWebhookAllowlistOrigins());
  if (allowlist.size === 0 || !allowlist.has(url.origin.toLowerCase())) {
    throw new PlatformError("FORBIDDEN", "Webhook origin is not allowlisted");
  }

  const method = String(actionConfig.method ?? "POST").toUpperCase();
  const maxAttempts = getAutomationWebhookMaxAttempts();
  const timeoutMs = getAutomationWebhookTimeoutMs();
  const secret = getAutomationWebhookSigningSecret();

  const payload = {
    runId: run.id,
    automationRuleId: run.automationRuleId,
    entityType: run.entityType,
    entityId: run.entityId,
    trigger: run.trigger,
    input,
    configPayload:
      actionConfig.payload && typeof actionConfig.payload === "object"
        ? (actionConfig.payload as Record<string, unknown>)
        : null,
  };

  const payloadBody = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");

  const customHeaders =
    actionConfig.headers && typeof actionConfig.headers === "object"
      ? Object.fromEntries(
          Object.entries(actionConfig.headers as Record<string, unknown>).map(([key, value]) => [
            key,
            String(value),
          ]),
        )
      : {};

  let lastError = "Webhook execution failed";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          "x-automation-run-id": run.id,
          "x-automation-signature": signature,
          ...customHeaders,
        },
        body: payloadBody,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const text = await response.text();
      if (!response.ok) {
        lastError = `Webhook responded with ${response.status}`;
        if (attempt < maxAttempts) continue;
        throw new PlatformError("CONFLICT", lastError);
      }

      return {
        url: url.toString(),
        method,
        status: response.status,
        attempts: attempt,
        response: text.slice(0, 2000),
      };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error.message : "Webhook request failed";

      if (error instanceof PlatformError) {
        throw error;
      }

      if (attempt >= maxAttempts) {
        throw new PlatformError("CONFLICT", `Webhook failed after ${maxAttempts} attempts: ${lastError}`);
      }
    }
  }

  throw new PlatformError("CONFLICT", lastError);
}

async function executeRunAction(
  ctx: PlatformRequestContext,
  run: AutomationRuleRun,
  rule: AutomationRule,
): Promise<Record<string, unknown>> {
  const actionConfig = (rule.actionConfig ?? {}) as Record<string, unknown>;
  const input = ((run.input as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;

  if (!matchesCondition(rule.condition, input)) {
    return {
      skipped: true,
      reason: "Condition did not match run input",
    };
  }

  switch (rule.actionType) {
    case AutomationActionType.SET_FIELD:
      return applySetFieldAction(ctx, run, actionConfig);
    case AutomationActionType.CREATE_TASK:
      return applyCreateTaskAction(ctx, run, actionConfig);
    case AutomationActionType.SEND_NOTIFICATION:
      return applySendNotificationAction(ctx, run, actionConfig);
    case AutomationActionType.CALL_WEBHOOK:
      return callWebhook(run, actionConfig, input);
    default:
      throw new PlatformError("VALIDATION_ERROR", `Unsupported automation action type: ${rule.actionType}`);
  }
}

export async function listAutomationRuns(ctx: PlatformRequestContext, input: unknown) {
  const parsed = automationRunListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid automation run query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.AutomationRuleRunWhereInput = {
    tenantId: ctx.tenantId,
    OR: [{ companyId: ctx.companyId }, { companyId: null }],
    ...(q.status ? { status: q.status } : {}),
    ...(q.automationRuleId ? { automationRuleId: q.automationRuleId } : {}),
    ...(q.trigger ? { trigger: q.trigger } : {}),
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.entityId ? { entityId: q.entityId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.automationRuleRun.findMany({
      where,
      include: {
        automationRule: {
          select: {
            id: true,
            name: true,
            trigger: true,
            actionType: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.automationRuleRun.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createAndExecuteAutomationRun(ctx: PlatformRequestContext, input: AutomationRunInput) {
  if (!input.automationRuleId) {
    throw new PlatformError("VALIDATION_ERROR", "automationRuleId is required to execute an automation run");
  }

  const rule = await prisma.automationRule.findUnique({ where: { id: input.automationRuleId } });
  if (!rule) {
    throw new PlatformError("NOT_FOUND", "Automation rule not found");
  }
  assertRuleScope(ctx, rule);

  if (input.idempotencyKey) {
    const existing = await prisma.automationRuleRun.findFirst({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        idempotencyKey: input.idempotencyKey,
      },
      include: {
        automationRule: {
          select: {
            id: true,
            name: true,
            trigger: true,
            actionType: true,
            isActive: true,
          },
        },
      },
    });

    if (existing) {
      return existing;
    }
  }

  const run = await prisma.automationRuleRun.create({
    data: {
      automationRuleId: rule.id,
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      trigger: input.trigger,
      status: AutomationRuleRunStatus.QUEUED,
      attempt: 1,
      idempotencyKey: input.idempotencyKey ?? null,
      input: (input.input ?? null) as never,
      createdBy: ctx.userId,
    },
  });

  return executeAutomationRun(ctx, run.id);
}

export async function createAutomationRun(ctx: PlatformRequestContext, input: unknown) {
  const parsed = automationRunCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid automation run payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  return createAndExecuteAutomationRun(ctx, {
    automationRuleId: payload.automationRuleId ?? null,
    entityType: payload.entityType,
    entityId: payload.entityId ?? null,
    trigger: payload.trigger,
    idempotencyKey: payload.idempotencyKey ?? null,
    input: payload.input ?? {},
  });
}

export async function executeAutomationRun(ctx: PlatformRequestContext, runId: string) {
  const run = await prisma.automationRuleRun.findUnique({
    where: { id: runId },
    include: {
      automationRule: true,
    },
  });

  if (!run || run.tenantId !== ctx.tenantId) {
    throw new PlatformError("NOT_FOUND", "Automation run not found");
  }

  if (!run.automationRule) {
    throw new PlatformError("VALIDATION_ERROR", "Automation run is missing automationRule relation");
  }

  assertRuleScope(ctx, run.automationRule);

  if (!run.automationRule.isActive) {
    throw new PlatformError("CONFLICT", "Cannot execute an inactive automation rule");
  }

  const now = new Date();
  await prisma.automationRuleRun.update({
    where: { id: run.id },
    data: {
      status: AutomationRuleRunStatus.RUNNING,
      startedAt: now,
    },
  });

  try {
    const output = await executeRunAction(ctx, run, run.automationRule);

    const completed = await prisma.automationRuleRun.update({
      where: { id: run.id },
      data: {
        status: AutomationRuleRunStatus.SUCCEEDED,
        output: output as never,
        errorMessage: null,
        finishedAt: new Date(),
      },
      include: {
        automationRule: {
          select: {
            id: true,
            name: true,
            trigger: true,
            actionType: true,
            isActive: true,
          },
        },
      },
    });

    await appendAuditEvent(ctx, {
      source: "platform.automation",
      action: "automation.run.succeeded",
      entityType: "AutomationRuleRun",
      entityId: completed.id,
      after: {
        status: completed.status,
      },
      metadata: {
        automationRuleId: completed.automationRuleId,
      },
    });

    await enqueueOutboxEvent(ctx, {
      topic: "platform.automation.run.succeeded",
      aggregateType: "AutomationRuleRun",
      aggregateId: completed.id,
      payload: {
        automationRunId: completed.id,
        automationRuleId: completed.automationRuleId,
        status: completed.status,
      },
    });

    return completed;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Automation run failed";

    const failed = await prisma.automationRuleRun.update({
      where: { id: run.id },
      data: {
        status: AutomationRuleRunStatus.FAILED,
        errorMessage,
        finishedAt: new Date(),
      },
      include: {
        automationRule: {
          select: {
            id: true,
            name: true,
            trigger: true,
            actionType: true,
            isActive: true,
          },
        },
      },
    });

    await appendAuditEvent(ctx, {
      source: "platform.automation",
      action: "automation.run.failed",
      entityType: "AutomationRuleRun",
      entityId: failed.id,
      after: {
        status: failed.status,
        errorMessage: failed.errorMessage,
      },
      metadata: {
        automationRuleId: failed.automationRuleId,
      },
    });

    await enqueueOutboxEvent(ctx, {
      topic: "platform.automation.run.failed",
      aggregateType: "AutomationRuleRun",
      aggregateId: failed.id,
      payload: {
        automationRunId: failed.id,
        automationRuleId: failed.automationRuleId,
        status: failed.status,
        errorMessage: failed.errorMessage,
      },
    });

    if (error instanceof PlatformError && error.code === "FORBIDDEN") {
      throw error;
    }

    return failed;
  }
}
