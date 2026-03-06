import crypto from "node:crypto";
import { AuditEventOrigin } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

type AuditEventInput = {
  source: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  origin?: AuditEventOrigin;
  decisionTrace?: unknown;
};

type ImmutableLedgerInput = {
  stream: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  companyId?: string | null;
};

export function stableStringify(value: unknown): string {
  if (value == null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function computeEventHash(input: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(stableStringify(input)).digest("hex");
}

export async function appendAuditEvent(ctx: PlatformRequestContext, input: AuditEventInput) {
  return prisma.auditEvent.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actorUserId: ctx.userId,
      source: input.source,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: (input.before ?? null) as never,
      after: (input.after ?? null) as never,
      metadata: (input.metadata ?? null) as never,
      origin: input.origin ?? AuditEventOrigin.HUMAN,
      decisionTrace: (input.decisionTrace ?? null) as never,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
    },
  });
}

export async function appendImmutableLedgerEvent(ctx: PlatformRequestContext, input: ImmutableLedgerInput) {
  const companyId = input.companyId ?? ctx.companyId;

  const previous = await prisma.immutableLedgerEvent.findFirst({
    where: {
      tenantId: ctx.tenantId,
      stream: input.stream,
      companyId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { eventHash: true },
  });

  const previousHash = previous?.eventHash ?? null;
  const hash = computeEventHash({
    tenantId: ctx.tenantId,
    companyId,
    stream: input.stream,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload,
    previousHash,
  });

  return prisma.immutableLedgerEvent.create({
    data: {
      tenantId: ctx.tenantId,
      companyId,
      stream: input.stream,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload as never,
      previousHash,
      eventHash: hash,
      metadata: (input.metadata ?? null) as never,
      createdBy: ctx.userId,
    },
  });
}

export async function verifyImmutableLedgerChain(
  ctx: PlatformRequestContext,
  input: { stream?: string },
): Promise<{
  ok: boolean;
  totalEvents: number;
  brokenAt?: { id: string; reason: string };
}> {
  const events = await prisma.immutableLedgerEvent.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(input.stream ? { stream: input.stream } : {}),
    },
    orderBy: [{ stream: "asc" }, { companyId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  const lastHashByChain = new Map<string, string | null>();

  for (const event of events) {
    const chainKey = `${event.stream}::${event.companyId ?? "global"}`;
    const expectedPrevious = lastHashByChain.get(chainKey) ?? null;

    if ((event.previousHash ?? null) !== expectedPrevious) {
      return {
        ok: false,
        totalEvents: events.length,
        brokenAt: {
          id: event.id,
          reason: "previousHash mismatch",
        },
      };
    }

    const recomputed = computeEventHash({
      tenantId: event.tenantId,
      companyId: event.companyId,
      stream: event.stream,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: event.payload,
      previousHash: event.previousHash,
    });

    if (recomputed !== event.eventHash) {
      return {
        ok: false,
        totalEvents: events.length,
        brokenAt: {
          id: event.id,
          reason: "event hash mismatch",
        },
      };
    }

    lastHashByChain.set(chainKey, event.eventHash);
  }

  return {
    ok: true,
    totalEvents: events.length,
  };
}

export async function enqueueOutboxEvent(
  ctx: PlatformRequestContext,
  input: {
    topic: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    headers?: Record<string, unknown>;
    companyId?: string;
  },
) {
  return prisma.outboxEvent.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: input.companyId ?? ctx.companyId,
      topic: input.topic,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload as never,
      headers: (input.headers ?? null) as never,
    },
  });
}

export async function listAuditEvents(
  ctx: PlatformRequestContext,
  input: { entityType?: string; entityId?: string; source?: string; limit: number },
) {
  return prisma.auditEvent.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(ctx.platformRole === "SUPER_ADMIN" ? {} : { companyId: ctx.companyId }),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.source ? { source: input.source } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: input.limit,
  });
}

export async function assertImmutableEventNotMutable(
  _ctx: PlatformRequestContext,
  _eventId: string,
): Promise<never> {
  void _ctx;
  void _eventId;
  throw new PlatformError("FORBIDDEN", "Immutable ledger events are append-only and cannot be modified");
}
