import { prisma } from "@/lib/prisma";
import { requirePermissionPage } from "@/modules/iam";
import {
  cancelInviteAction,
  changeMemberRoleAction,
  inviteMemberAction,
  removeMemberAction,
  resendInviteAction,
  setMemberStatusAction,
} from "@/app/(app)/org/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function OrgMembersPage() {
  const principal = await requirePermissionPage("admin.members", "/org/members");

  const [memberships, roles, pendingInvites] = await Promise.all([
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
      select: { id: true, name: true, description: true },
    }),
    prisma.iamInvitation.findMany({
      where: {
        companyId: principal.activeCompanyId,
        acceptedAt: null,
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        role: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);
  const submitInviteMember = async (formData: FormData) => {
    "use server";
    await inviteMemberAction(formData);
  };
  const submitResendInvite = async (formData: FormData) => {
    "use server";
    await resendInviteAction(formData);
  };
  const submitCancelInvite = async (formData: FormData) => {
    "use server";
    await cancelInviteAction(formData);
  };
  const submitChangeMemberRole = async (formData: FormData) => {
    "use server";
    await changeMemberRoleAction(formData);
  };
  const submitSetMemberStatus = async (formData: FormData) => {
    "use server";
    await setMemberStatusAction(formData);
  };
  const submitRemoveMember = async (formData: FormData) => {
    "use server";
    await removeMemberAction(formData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">Invite users and manage tenant roles.</p>
      </div>

      <form action={submitInviteMember} className="grid gap-2 rounded-lg border p-4 md:grid-cols-[1fr,220px,auto]">
        <Input name="email" type="email" placeholder="new.user@company.com" required />
        <select name="roleId" className="h-9 rounded-md border border-border bg-transparent px-3">
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
        <Button type="submit">Send invite</Button>
      </form>

      <div className="space-y-2 rounded-lg border p-4">
        <h2 className="font-medium">Pending invitations</h2>
        {pendingInvites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invites.</p>
        ) : (
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
                <div>
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Role: {invite.role?.name ?? "MEMBER"} · Expires: {new Date(invite.expiresAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={submitResendInvite}>
                    <input type="hidden" name="invitationId" value={invite.id} />
                    <Button type="submit" variant="outline" size="sm">Resend</Button>
                  </form>
                  <form action={submitCancelInvite}>
                    <input type="hidden" name="invitationId" value={invite.id} />
                    <Button type="submit" variant="outline" size="sm">Cancel</Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {memberships.map((membership) => (
          <div key={membership.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{membership.user.name}</p>
                <p className="text-sm text-muted-foreground">{membership.user.email}</p>
                <p className="text-xs text-muted-foreground">Status: {membership.status}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <form action={submitChangeMemberRole} className="flex items-center gap-2">
                  <input type="hidden" name="companyId" value={membership.companyId} />
                  <input type="hidden" name="userId" value={membership.userId} />
                  <select name="roleId" defaultValue={membership.roleId ?? ""} className="h-9 rounded-md border border-border bg-transparent px-3">
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline">Update role</Button>
                </form>

                <form action={submitSetMemberStatus} className="flex items-center gap-2">
                  <input type="hidden" name="companyId" value={membership.companyId} />
                  <input type="hidden" name="userId" value={membership.userId} />
                  <select name="status" defaultValue={membership.status} className="h-9 rounded-md border border-border bg-transparent px-3">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="INVITED">INVITED</option>
                  </select>
                  <Button type="submit" variant="outline">Update status</Button>
                </form>

                <form action={submitRemoveMember}>
                  <input type="hidden" name="companyId" value={membership.companyId} />
                  <input type="hidden" name="userId" value={membership.userId} />
                  <Button type="submit" variant="outline">Remove</Button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
