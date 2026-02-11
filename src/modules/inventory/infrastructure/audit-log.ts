import { prisma } from "@/lib/prisma";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";

type InventoryAuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  diff?: unknown;
  metadata?: Record<string, unknown>;
};

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
}
