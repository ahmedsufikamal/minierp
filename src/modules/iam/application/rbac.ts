import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/modules/iam/domain/permissions";
import { defaultRolePermissions } from "@/modules/iam/domain/permissions";

export async function getPermissionsForUserCompany(userId: string, companyId: string): Promise<PermissionKey[]> {
  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { role: true, roleId: true },
  });

  if (!membership) return [];

  if (!membership.roleId) {
    return (defaultRolePermissions[membership.role] ?? []) as PermissionKey[];
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

  if (!role) return (defaultRolePermissions[membership.role] ?? []) as PermissionKey[];

  return role.permissions.map((p) => p.permission.key as PermissionKey);
}

export async function hasPermission(userId: string, companyId: string, permission: PermissionKey): Promise<boolean> {
  const permissions = await getPermissionsForUserCompany(userId, companyId);
  return permissions.includes(permission);
}
