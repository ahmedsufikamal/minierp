import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IamError } from "@/modules/iam/domain/errors";
import { permissionCatalog, type PermissionKey } from "@/modules/iam/domain/permissions";
import { getIdentityProvider } from "@/modules/iam/infrastructure/provider";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";
import { getUserTypeLabelForLevel, mapRoleToUserTypeLevel, normalizeUserTypeLevel } from "@/modules/iam/application/level-policy";
import { assertDirectRoleChangeAllowed } from "@/modules/iam/application/master-admin";
import { maskSessionId } from "@/modules/iam/application/user-self.service";
import type { IamPrincipal } from "@/modules/iam/domain/types";

export type PermissionCatalogGroup = {
  module: string;
  permissions: Array<{ key: PermissionKey; description: string }>;
};

export function groupPermissionCatalog(): PermissionCatalogGroup[] {
  const grouped = new Map<string, PermissionCatalogGroup>();

  for (const [key, meta] of Object.entries(permissionCatalog) as Array<[PermissionKey, (typeof permissionCatalog)[PermissionKey]]>) {
    const existing = grouped.get(meta.module) ?? { module: meta.module, permissions: [] };
    existing.permissions.push({ key, description: meta.description });
    grouped.set(meta.module, existing);
  }

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    permissions: group.permissions.sort((left, right) => left.key.localeCompare(right.key)),
  }));
}

export async function listAdminUsers(input: {
  query?: string;
  platformRole?: "ALL" | "SUPER_ADMIN" | "SUPPORT" | "NONE";
  status?: "ALL" | "ACTIVE" | "INVITED" | "SUSPENDED" | "DISABLED";
  companyId?: string;
}) {
  const where: Prisma.UserWhereInput = {
    ...(input.query
      ? {
          OR: [
            { email: { contains: input.query, mode: "insensitive" } },
            { name: { contains: input.query, mode: "insensitive" } },
            { phone: { contains: input.query } },
            { id: { contains: input.query } },
          ],
        }
      : {}),
    ...(input.platformRole && input.platformRole !== "ALL" ? { platformRole: input.platformRole } : {}),
    ...(input.status && input.status !== "ALL" ? { status: input.status } : {}),
    ...(input.companyId
      ? {
          memberships: {
            some: { companyId: input.companyId },
          },
        }
      : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      platformRole: true,
      status: true,
      activeCompanyId: true,
      createdAt: true,
      memberships: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          companyId: true,
          role: true,
          status: true,
          company: { select: { name: true } },
        },
      },
    },
  });

  return {
    items: users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      memberships: user.memberships.map((membership) => ({
        ...membership,
        companyName: membership.company.name,
      })),
    })),
  };
}

export async function getAdminUserDetail(userId: string, principal: IamPrincipal) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      platformRole: true,
      status: true,
      activeCompanyId: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          companyId: true,
          roleId: true,
          role: true,
          userTypeLevel: true,
          userTypeLabel: true,
          status: true,
          joinedAt: true,
          lastActiveAt: true,
          company: { select: { name: true } },
          permissionOverrides: {
            select: {
              permission: { select: { key: true } },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new IamError("NOT_FOUND", "User not found");
  }

  const selectedMembership =
    user.memberships.find((membership) => membership.companyId === user.activeCompanyId) ?? user.memberships[0] ?? null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    platformRole: user.platformRole,
    status: user.status,
    activeCompanyId: user.activeCompanyId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    memberships: user.memberships.map((membership) => ({
      companyId: membership.companyId,
      companyName: membership.company.name,
      roleId: membership.roleId,
      role: membership.role,
      userTypeLevel: membership.userTypeLevel,
      userTypeLabel: membership.userTypeLabel,
      status: membership.status,
      joinedAt: membership.joinedAt?.toISOString() ?? null,
      lastActiveAt: membership.lastActiveAt?.toISOString() ?? null,
      permissionKeys: membership.permissionOverrides.map((entry) => entry.permission.key as PermissionKey),
    })),
    selectedCompanyId: selectedMembership?.companyId ?? null,
    auditMeta: {
      createdBy: "System",
      createdAt: user.createdAt.toISOString(),
      lastEditedBy: principal.email,
      lastEditedAt: user.updatedAt.toISOString(),
    },
  };
}

export async function updateAdminUserBasics(input: {
  actor: IamPrincipal;
  targetUserId: string;
  data: {
    name?: string;
    email?: string;
    phone?: string | null;
    avatarUrl?: string | null;
    status?: "ACTIVE" | "INVITED" | "SUSPENDED" | "DISABLED";
    platformRole?: "SUPER_ADMIN" | "SUPPORT" | "NONE";
  };
}) {
  const existing = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      status: true,
      platformRole: true,
      activeCompanyId: true,
    },
  });

  if (!existing) {
    throw new IamError("NOT_FOUND", "User not found");
  }

  try {
    const updated = await prisma.user.update({
      where: { id: input.targetUserId },
      data: {
        name: input.data.name?.trim() || undefined,
        email: input.data.email?.trim().toLowerCase() || undefined,
        phone: input.data.phone === undefined ? undefined : input.data.phone,
        avatarUrl: input.data.avatarUrl === undefined ? undefined : input.data.avatarUrl,
        status: input.data.status,
        platformRole: input.data.platformRole,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        status: true,
        platformRole: true,
      },
    });

    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: existing.activeCompanyId,
      actorUserId: input.actor.userId,
      entityType: "User",
      entityId: input.targetUserId,
      before: existing,
      after: updated,
    });

    return updated;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new IamError("CONFLICT", "Email already in use");
    }
    throw error;
  }
}

export async function listCompanyRoles(companyId: string) {
  const [roles, permissions] = await Promise.all([
    prisma.iamRole.findMany({
      where: { companyId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        isDefault: true,
      },
    }),
    Promise.resolve(groupPermissionCatalog()),
  ]);

  return {
    roles,
    permissionCatalog: permissions,
  };
}

export async function updateUserMembershipAccess(input: {
  actor: IamPrincipal;
  targetUserId: string;
  companyId: string;
  roleId: string;
  userTypeLevel?: number;
  permissionKeys: string[];
}) {
  const membership = await prisma.companyMembership.findUnique({
    where: {
      userId_companyId: {
        userId: input.targetUserId,
        companyId: input.companyId,
      },
    },
    select: {
      role: true,
      roleId: true,
      status: true,
      userTypeLevel: true,
      permissionOverrides: {
        select: {
          permission: { select: { key: true } },
        },
      },
    },
  });

  if (!membership) {
    throw new IamError("NOT_FOUND", "Membership not found");
  }

  const role = await prisma.iamRole.findUnique({
    where: { id: input.roleId },
    select: { id: true, name: true, companyId: true },
  });

  if (!role || role.companyId !== input.companyId) {
    throw new IamError("VALIDATION_ERROR", "Role does not belong to the selected company");
  }

  assertDirectRoleChangeAllowed({
    currentRole: membership.role,
    currentStatus: membership.status,
    nextRole: role.name,
  });

  const uniqueKeys = [...new Set(input.permissionKeys)] as PermissionKey[];
  const permissions = await prisma.iamPermission.findMany({
    where: { key: { in: uniqueKeys } },
    select: { id: true, key: true },
  });

  if (permissions.length !== uniqueKeys.length) {
    const found = new Set(permissions.map((permission) => permission.key));
    const missing = uniqueKeys.filter((key) => !found.has(key));
    throw new IamError("VALIDATION_ERROR", "Unknown permission keys", { missing });
  }

  const nextLevel = normalizeUserTypeLevel(
    input.userTypeLevel,
    mapRoleToUserTypeLevel(role.name),
  );

  const updated = await prisma.$transaction(async (tx) => {
    const membershipUpdate = await tx.companyMembership.update({
      where: {
        userId_companyId: {
          userId: input.targetUserId,
          companyId: input.companyId,
        },
      },
      data: {
        roleId: role.id,
        role: role.name,
        userTypeLevel: nextLevel,
        userTypeLabel: getUserTypeLabelForLevel(nextLevel),
      },
      select: {
        role: true,
        roleId: true,
        userTypeLevel: true,
        userTypeLabel: true,
      },
    });

    await tx.companyMembershipPermission.deleteMany({
      where: {
        userId: input.targetUserId,
        companyId: input.companyId,
      },
    });

    for (const permission of permissions) {
      await tx.companyMembershipPermission.create({
        data: {
          userId: input.targetUserId,
          companyId: input.companyId,
          permissionId: permission.id,
          createdBy: input.actor.userId,
        },
      });
    }

    return membershipUpdate;
  });

  await writeIamAudit({
    action: "ROLE_CHANGED",
    companyId: input.companyId,
    actorUserId: input.actor.userId,
    entityType: "CompanyMembership",
    entityId: `${input.targetUserId}:${input.companyId}`,
    before: {
      role: membership.role,
      roleId: membership.roleId,
      userTypeLevel: membership.userTypeLevel,
      permissionKeys: membership.permissionOverrides.map((entry) => entry.permission.key),
    },
    after: {
      role: updated.role,
      roleId: updated.roleId,
      userTypeLevel: updated.userTypeLevel,
      permissionKeys: uniqueKeys,
    },
  });

  return {
    companyId: input.companyId,
    role: updated.role,
    roleId: updated.roleId,
    userTypeLevel: updated.userTypeLevel,
    userTypeLabel: updated.userTypeLabel,
    permissionKeys: uniqueKeys,
  };
}

export async function listAdminUserSessions(targetUserId: string, principal: IamPrincipal) {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });

  if (!user) {
    throw new IamError("NOT_FOUND", "User not found");
  }

  const sessions = await getIdentityProvider().listUserSessions(targetUserId);

  return {
    sessions: sessions.map((session) => ({
      id: session.id,
      maskedId: maskSessionId(session.id),
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      ip: session.ip ?? null,
      userAgent: session.userAgent ?? null,
      isCurrent: principal.userId === targetUserId && session.id === principal.sessionId,
    })),
  };
}

export async function revokeAdminUserSession(input: {
  actor: IamPrincipal;
  targetUserId: string;
  sessionId: string;
}) {
  const session = await prisma.iamSession.findUnique({
    where: { id: input.sessionId },
    select: { id: true, userId: true, companyId: true },
  });

  if (!session || session.userId !== input.targetUserId) {
    throw new IamError("NOT_FOUND", "Session not found for user");
  }

  await getIdentityProvider().revokeSession(input.sessionId, input.actor.userId);
  await writeIamAudit({
    action: "SESSION_REVOKED",
    companyId: session.companyId,
    actorUserId: input.actor.userId,
    entityType: "IamSession",
    entityId: input.sessionId,
    metadata: { targetUserId: input.targetUserId, adminAction: true },
  });

  return { revoked: true };
}
