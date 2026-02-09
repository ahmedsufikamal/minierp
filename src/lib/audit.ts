import "server-only";
import { prisma } from "@/lib/prisma";

type AuditPayload = {
  companyId: string;
  userId: string;
  action: "CREATED" | "UPDATED" | "DELETED";
  entityType: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
};

export async function logAudit(p: AuditPayload): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyId: p.companyId,
      userId: p.userId,
      action: p.action,
      entityType: p.entityType,
      entityId: p.entityId ?? null,
      oldValues: p.oldValues != null ? JSON.stringify(p.oldValues) : null,
      newValues: p.newValues != null ? JSON.stringify(p.newValues) : null,
    },
  });
}
