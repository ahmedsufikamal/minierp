import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformPermission, PlatformRequestContext } from "@/modules/platform/domain/types";

function isSchemaMismatch(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export function hasPlatformPermission(ctx: PlatformRequestContext, permission: PlatformPermission): boolean {
  if (ctx.platformRole === "SUPER_ADMIN") return true;
  return ctx.permissions.includes(permission);
}

export function assertPlatformPermission(ctx: PlatformRequestContext, permission: PlatformPermission): void {
  if (!hasPlatformPermission(ctx, permission)) {
    throw new PlatformError("FORBIDDEN", `Missing permission: ${permission}`);
  }
}

export async function hasScopedPermission(input: {
  tenantId: string;
  userId: string;
  module: string;
  resource: string;
  action: string;
}): Promise<boolean> {
  try {
    const memberships = await prisma.tenantMembership.findMany({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        status: "ACTIVE",
        roleProfileId: { not: null },
      },
      select: { roleProfileId: true },
    });

    const roleProfileIds = memberships
      .map((membership) => membership.roleProfileId)
      .filter((id): id is string => Boolean(id));

    if (roleProfileIds.length === 0) {
      return false;
    }

    const rules = await prisma.permissionRule.findMany({
      where: {
        tenantId: input.tenantId,
        roleProfileId: { in: roleProfileIds },
        module: input.module,
        resource: input.resource,
        action: input.action,
      },
      select: { effect: true },
    });

    if (rules.some((rule) => rule.effect === "DENY")) return false;
    return rules.some((rule) => rule.effect === "ALLOW");
  } catch (error) {
    if (isSchemaMismatch(error)) {
      return false;
    }
    throw error;
  }
}
