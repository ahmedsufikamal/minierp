import { prisma } from "@/lib/prisma";
import {
  assertDirectMembershipRemovalAllowed,
  assertDirectRoleChangeAllowed,
  assertDirectStatusChangeAllowed,
} from "@/modules/iam/application/master-admin";
import {
  assertCanManageTargetLevel,
  getUserTypeLabelForLevel,
  mapRoleToUserTypeLevel,
  normalizeUserTypeLevel,
} from "@/modules/iam/application/level-policy";
import { requirePermission, requireStepUp } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { z } from "zod";

const updateMemberSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INVITED", "SUSPENDED"]).optional(),
  userTypeLevel: z.number().int().refine((value) => [2, 3, 4, 5, 9].includes(value)).optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const principal = await requirePermission("admin.members");
    const { id } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant member access blocked");
    }

    const members = await prisma.companyMembership.findMany({
      where: { companyId: id },
      select: {
        userId: true,
        role: true,
        roleId: true,
        userTypeLevel: true,
        userTypeLabel: true,
        status: true,
        joinedAt: true,
        lastActiveAt: true,
        user: {
          select: {
            email: true,
            name: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return ok(members);
  } catch (error) {
    return err(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.members");
    await requireStepUp();
    const { id } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant member update blocked");
    }
    const body = await parseBody(request, updateMemberSchema);
    const currentMembership = await prisma.companyMembership.findUnique({
      where: {
        userId_companyId: {
          userId: body.userId,
          companyId: id,
        },
      },
      select: { role: true, status: true, userTypeLevel: true },
    });
    if (!currentMembership) {
      throw new IamError("NOT_FOUND", "Membership not found");
    }
    const currentLevel = normalizeUserTypeLevel(currentMembership.userTypeLevel, mapRoleToUserTypeLevel(currentMembership.role));
    assertCanManageTargetLevel(principal.effectiveLevel, currentLevel);

    const role = body.roleId
      ? await prisma.iamRole.findUnique({ where: { id: body.roleId }, select: { id: true, name: true, companyId: true } })
      : null;
    if (role && role.companyId !== id) {
      throw new IamError("VALIDATION_ERROR", "Role does not belong to the target tenant");
    }

    if (role) {
      assertDirectRoleChangeAllowed({
        currentRole: currentMembership.role,
        currentStatus: currentMembership.status,
        nextRole: role.name,
      });
    }
    if (body.status) {
      assertDirectStatusChangeAllowed({
        currentRole: currentMembership.role,
        currentStatus: currentMembership.status,
        nextStatus: body.status,
      });
    }

    const nextLevel =
      body.userTypeLevel !== undefined
        ? normalizeUserTypeLevel(body.userTypeLevel, currentLevel)
        : role
          ? mapRoleToUserTypeLevel(role.name)
          : currentLevel;
    assertCanManageTargetLevel(principal.effectiveLevel, nextLevel);

    const updated = await prisma.companyMembership.update({
      where: { userId_companyId: { userId: body.userId, companyId: id } },
      data: {
        roleId: body.roleId === undefined ? undefined : body.roleId,
        role: role?.name ?? undefined,
        userTypeLevel: nextLevel,
        userTypeLabel: getUserTypeLabelForLevel(nextLevel),
        status: body.status,
      },
      select: { userId: true, companyId: true, role: true, roleId: true, status: true, userTypeLevel: true, userTypeLabel: true },
    });

    await writeIamAudit({
      action: "ROLE_CHANGED",
      companyId: id,
      actorUserId: principal.userId,
      entityType: "CompanyMembership",
      entityId: `${updated.userId}:${updated.companyId}`,
      before: {
        role: currentMembership.role,
        status: currentMembership.status,
        userTypeLevel: currentLevel,
      },
      after: {
        role: updated.role,
        status: updated.status,
        userTypeLevel: updated.userTypeLevel,
      },
    });

    return ok(updated);
  } catch (error) {
    return err(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.members");
    const { id } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant member deletion blocked");
    }
    const body = await parseBody(request, z.object({ userId: z.string().min(1) }));
    const membership = await prisma.companyMembership.findUnique({
      where: {
        userId_companyId: {
          userId: body.userId,
          companyId: id,
        },
      },
      select: { role: true, status: true, userTypeLevel: true },
    });
    if (!membership) {
      throw new IamError("NOT_FOUND", "Membership not found");
    }
    const targetLevel = normalizeUserTypeLevel(membership.userTypeLevel, mapRoleToUserTypeLevel(membership.role));
    assertCanManageTargetLevel(principal.effectiveLevel, targetLevel);
    assertDirectMembershipRemovalAllowed({
      currentRole: membership.role,
      currentStatus: membership.status,
    });

    await prisma.companyMembership.delete({
      where: {
        userId_companyId: {
          userId: body.userId,
          companyId: id,
        },
      },
    });

    return ok({ removed: true });
  } catch (error) {
    return err(error);
  }
}
