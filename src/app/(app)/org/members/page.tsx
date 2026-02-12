import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/iam";
import { changeMemberRoleAction, inviteMemberAction } from "@/app/(app)/org/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function OrgMembersPage() {
  const principal = await requirePermission("admin.members");

  const [memberships, roles] = await Promise.all([
    prisma.companyMembership.findMany({
      where: { companyId: principal.activeCompanyId },
      include: {
        user: {
          select: {
            email: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.iamRole.findMany({
      where: { companyId: principal.activeCompanyId },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">Invite users and manage tenant roles.</p>
      </div>

      <form action={inviteMemberAction} className="grid gap-2 rounded-lg border p-4 md:grid-cols-[1fr,220px,auto]">
        <Input name="email" type="email" placeholder="new.user@company.com" required />
        <select name="roleId" className="h-9 rounded-md border border-border bg-transparent px-3">
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
        <Button type="submit">Send invite</Button>
      </form>

      <div className="space-y-2">
        {memberships.map((membership) => (
          <div key={membership.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{membership.user.name}</p>
                <p className="text-sm text-muted-foreground">{membership.user.email}</p>
              </div>

              <form action={changeMemberRoleAction} className="flex items-center gap-2">
                <input type="hidden" name="companyId" value={membership.companyId} />
                <input type="hidden" name="userId" value={membership.userId} />
                <select name="roleId" defaultValue={membership.roleId ?? ""} className="h-9 rounded-md border border-border bg-transparent px-3">
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                <Button type="submit" variant="outline">Update role</Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
