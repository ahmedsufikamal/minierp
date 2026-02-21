import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/modules/iam/domain/permissions";
import { defaultRolePermissions } from "@/modules/iam/domain/permissions";

export async function getPermissionsForUserCompany(userId: string, companyId: string): Promise<PermissionKey[]> {
  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { role: true, roleId: true },
  });

  if (!membership) return [];

  const membershipOverrides = await prisma.companyMembershipPermission.findMany({
    where: { userId, companyId },
    select: {
      permission: {
        select: { key: true },
      },
    },
  });

  if (!membership.roleId) {
    const defaults = (defaultRolePermissions[membership.role] ?? []) as PermissionKey[];
    const merged = new Set<PermissionKey>(defaults);
    membershipOverrides.forEach((item) => {
      merged.add(item.permission.key as PermissionKey);
    });
    return [...merged];
  }

  const role = await prisma.iamRole.findUnique({
    where: { id: membership.roleId },
    select: {
      permissions: {
        select: {
          permission: { select: { key: true } },
        },
      },
    },
  });

  const merged = new Set<PermissionKey>(
    (role
      ? role.permissions.map((p) => p.permission.key as PermissionKey)
      : (defaultRolePermissions[membership.role] ?? []) as PermissionKey[]),
  );
  membershipOverrides.forEach((item) => {
    merged.add(item.permission.key as PermissionKey);
  });

  return [...merged];
}

export async function hasPermission(userId: string, companyId: string, permission: PermissionKey): Promise<boolean> {
  const permissions = await getPermissionsForUserCompany(userId, companyId);
  return permissions.includes(permission);
}
