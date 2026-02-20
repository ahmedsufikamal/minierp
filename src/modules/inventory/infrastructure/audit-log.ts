import { prisma } from "@/lib/prisma";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import {
  appendAuditEvent,
  appendImmutableLedgerEvent,
  enqueueOutboxEvent,
} from "@/modules/platform/application/audit-ledger.service";

type InventoryAuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  diff?: unknown;
  metadata?: Record<string, unknown>;
};

function isCriticalInventoryEvent(action: string): boolean {
  const upper = action.toUpperCase();
  return (
    upper.includes("POST") ||
    upper.includes("SUBMIT") ||
    upper.includes("APPROVE") ||
    upper.includes("REJECT") ||
    upper.includes("CANCEL") ||
    upper.includes("LEDGER") ||
    upper.includes("RECONCILIATION") ||
    upper.includes("RESERVATION") ||
    upper.includes("SERIAL") ||
    upper.includes("BATCH")
  );
}

export async function writeInventoryAudit(ctx: InventoryRequestContext, input: InventoryAuditInput): Promise<void> {
  await prisma.inventoryAuditLog.create({
    data: {
      companyId: ctx.companyId,
      actorUserId: ctx.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: input.before as never,
      after: input.after as never,
      diff: input.diff as never,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      metadata: (input.metadata ?? null) as never,
    },
  });

  const platformCtx = {
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

  await appendAuditEvent(platformCtx, {
    source: "inventory",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    before: input.before,
    after: input.after,
    metadata: input.metadata,
  });

  if (isCriticalInventoryEvent(input.action) && input.entityId) {
    await appendImmutableLedgerEvent(platformCtx, {
      stream: "inventory",
      eventType: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: {
        before: input.before ?? null,
        after: input.after ?? null,
      },
      metadata: input.metadata,
    });

    await enqueueOutboxEvent(platformCtx, {
      topic: "inventory.audit",
      aggregateType: input.entityType,
      aggregateId: input.entityId,
      payload: {
        action: input.action,
        entityType: input.entityType,
      },
    });
  }
}
