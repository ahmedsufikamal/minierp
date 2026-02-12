import { prisma } from "@/lib/prisma";
import { Prisma, type IamAuditAction } from "@prisma/client";

function toNullableJson(value: unknown):
  | Prisma.InputJsonValue
  | Prisma.NullableJsonNullValueInput
  | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

export async function writeIamAudit(input: {
  action: IamAuditAction;
  companyId?: string | null;
  actorUserId?: string | null;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await prisma.iamAuditLog.create({
    data: {
      action: input.action,
      companyId: input.companyId ?? null,
      actorUserId: input.actorUserId ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: toNullableJson(input.before),
      after: toNullableJson(input.after),
      metadata: toNullableJson(input.metadata),
      requestId: input.requestId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
