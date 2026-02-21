import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireStepUp } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { err, ok, parseBody } from "@/modules/iam/interface/http";
import {
  assertCanManageTargetLevel,
  mapRoleToUserTypeLevel,
  normalizeUserTypeLevel,
  USER_TYPE_LEVEL,
} from "@/modules/iam/application/level-policy";

const permissionsUpdateSchema = z.object({
  permissionKeys: z.array(z.string().min(1)).max(500),
});

type RouteParams = { id: string; userId: string };

export async function GET(_: Request, { params }: { params: Promise<RouteParams> }) {
  try {
    const principal = await requirePermission("admin.members");
    const { id, userId } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant permission access blocked");
    }

    const membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId, companyId: id } },
      select: { role: true, userTypeLevel: true, status: true },
    });
    if (!membership) {
      throw new IamError("NOT_FOUND", "Membership not found");
    }

    const targetLevel = normalizeUserTypeLevel(membership.userTypeLevel, mapRoleToUserTypeLevel(membership.role));
    assertCanManageTargetLevel(principal.effectiveLevel, targetLevel);

    const rows = await prisma.companyMembershipPermission.findMany({
      where: { userId, companyId: id },
      select: {
        permission: { select: { key: true, module: true, description: true } },
      },
      orderBy: [{ permission: { module: "asc" } }, { permission: { key: "asc" } }],
    });

    return ok({
      userId,
      companyId: id,
      userTypeLevel: targetLevel,
      permissionKeys: rows.map((row) => row.permission.key),
      permissions: rows.map((row) => row.permission),
    });
  } catch (error) {
    return err(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<RouteParams> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.members");
    await requireStepUp();
    const { id, userId } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant permission update blocked");
    }

    const body = await parseBody(request, permissionsUpdateSchema);
    const membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId, companyId: id } },
      select: { role: true, userTypeLevel: true, status: true },
    });
    if (!membership) {
      throw new IamError("NOT_FOUND", "Membership not found");
    }

    const targetLevel = normalizeUserTypeLevel(membership.userTypeLevel, mapRoleToUserTypeLevel(membership.role));
    assertCanManageTargetLevel(principal.effectiveLevel, targetLevel);
    if (targetLevel !== USER_TYPE_LEVEL.GENERAL_USER) {
      throw new IamError("VALIDATION_ERROR", "Custom permission assignment is allowed for level 3 users only");
    }

    const uniqueKeys = [...new Set(body.permissionKeys.map((key) => key.trim()).filter(Boolean))];
    const permissions = await prisma.iamPermission.findMany({
      where: { key: { in: uniqueKeys } },
      select: { id: true, key: true },
    });
    if (permissions.length !== uniqueKeys.length) {
      const found = new Set(permissions.map((row) => row.key));
      const missing = uniqueKeys.filter((key) => !found.has(key));
      throw new IamError("VALIDATION_ERROR", "Unknown permission keys", { missing });
    }

    const existing = await prisma.companyMembershipPermission.findMany({
      where: { userId, companyId: id },
      select: { permission: { select: { key: true } } },
    });

    await prisma.$transaction(async (tx) => {
      await tx.companyMembershipPermission.deleteMany({
        where: { userId, companyId: id },
      });
      for (const permission of permissions) {
        await tx.companyMembershipPermission.create({
          data: {
            userId,
            companyId: id,
            permissionId: permission.id,
            createdBy: principal.userId,
          },
        });
      }
    });

    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: id,
      actorUserId: principal.userId,
      entityType: "CompanyMembershipPermission",
      entityId: `${userId}:${id}`,
      before: { permissionKeys: existing.map((row) => row.permission.key) },
      after: { permissionKeys: uniqueKeys },
    });

    return ok({
      userId,
      companyId: id,
      permissionKeys: uniqueKeys,
      updated: true,
    });
  } catch (error) {
    return err(error);
  }
}
