import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/iam";
import { createRoleAction } from "@/app/(app)/org/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function OrgRolesPage() {
  const principal = await requirePermission("admin.roles");

  const [roles, permissions] = await Promise.all([
    prisma.iamRole.findMany({
      where: { companyId: principal.activeCompanyId },
      include: {
        permissions: {
          include: {
            permission: {
              select: { id: true, key: true, module: true },
            },
          },
        },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    }),
    prisma.iamPermission.findMany({
      orderBy: [{ module: "asc" }, { key: "asc" }],
      select: { id: true, key: true, module: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Roles and permissions</h1>
        <p className="text-sm text-muted-foreground">Build custom tenant roles and permission matrices.</p>
      </div>

      <form action={createRoleAction} className="space-y-3 rounded-lg border p-4">
        <Input name="name" placeholder="Role name" required />
        <Input name="description" placeholder="Description" />
        <div className="grid gap-2 md:grid-cols-2">
          {permissions.map((permission) => (
            <label key={permission.id} className="text-sm">
              <input type="checkbox" name="permissionKeys" value={permission.key} className="mr-2" />
              {permission.key}
            </label>
          ))}
        </div>
        <Button type="submit">Create role</Button>
      </form>

      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role.id} className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{role.name}</p>
              {role.isSystem ? <span className="text-xs text-muted-foreground">system</span> : null}
            </div>
            <div className="flex flex-wrap gap-1">
              {role.permissions.map((rp) => (
                <span key={rp.id} className="rounded bg-muted px-2 py-1 text-xs">
                  {rp.permission.key}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
