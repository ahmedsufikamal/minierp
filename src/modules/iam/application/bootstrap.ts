import { prisma } from "@/lib/prisma";
import { defaultRoleDescriptions, defaultRolePermissions, permissionCatalog, type PermissionKey } from "@/modules/iam/domain/permissions";

export async function ensurePermissionCatalog(): Promise<void> {
  for (const [key, meta] of Object.entries(permissionCatalog)) {
    await prisma.iamPermission.upsert({
      where: { key },
      create: {
        key,
        module: meta.module,
        description: meta.description,
      },
      update: {
        module: meta.module,
        description: meta.description,
      },
    });
  }
}

export async function ensureDefaultTenantRoles(companyId: string): Promise<void> {
  await ensurePermissionCatalog();

  const permissions = await prisma.iamPermission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

  for (const [roleName, permissionKeys] of Object.entries(defaultRolePermissions)) {
    const role = await prisma.iamRole.upsert({
      where: { companyId_name: { companyId, name: roleName } },
      create: {
        companyId,
        name: roleName,
        description: defaultRoleDescriptions[roleName] ?? roleName,
        isSystem: true,
        isDefault: roleName === "OWNER",
      },
      update: {
        description: defaultRoleDescriptions[roleName] ?? roleName,
      },
      select: { id: true },
    });

    for (const permissionKey of permissionKeys as PermissionKey[]) {
      const permissionId = permissionIdByKey.get(permissionKey);
      if (!permissionId) continue;
      await prisma.iamRolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }
  }
}
