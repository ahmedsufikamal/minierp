import { prisma } from "@/lib/prisma";
import { requirePermissionPage } from "@/modules/iam";
import {
  cancelInviteAction,
  changeMemberRoleAction,
  inviteMemberAction,
  removeMemberAction,
  resendInviteAction,
  setMemberPermissionOverridesAction,
  setMemberStatusAction,
  transferMasterAdminAction,
} from "@/app/(app)/org/actions";
import { MASTER_ADMIN_ROLE_NAME, getTenantRoleLabel } from "@/modules/iam/application/master-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeUserTypeLevel } from "@/modules/iam/application/level-policy";

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
  const submitTransferMasterAdmin = async (formData: FormData) => {
    "use server";
    await transferMasterAdminAction(formData);
  };
  const submitSetMemberPermissionOverrides = async (formData: FormData) => {
    "use server";
    await setMemberPermissionOverridesAction(formData);
  };
  const assignableRoles = roles.filter((role) => role.name !== MASTER_ADMIN_ROLE_NAME);
  const editableLevels = [
    { value: 5, label: "Level 5 · Master User" },
    { value: 4, label: "Level 4 · Administrator" },
    { value: 3, label: "Level 3 · General User" },
    { value: 2, label: "Level 2 · Support User" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">Invite users and manage tenant roles.</p>
      </div>

      <form action={submitInviteMember} className="grid gap-2 rounded-lg border p-4 md:grid-cols-[1fr,220px,auto]">
        <Input name="email" type="email" placeholder="new.user@company.com" required />
        <select name="roleId" className="h-9 rounded-md border border-border bg-transparent px-3">
          {assignableRoles.map((role) => (
            <option key={role.id} value={role.id}>{getTenantRoleLabel(role.name)}</option>
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
                    Role: {getTenantRoleLabel(invite.role?.name ?? "MEMBER")} · Expires: {new Date(invite.expiresAt).toLocaleString()}
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
            {(() => {
              const isMasterAdmin = membership.role === MASTER_ADMIN_ROLE_NAME && membership.status === "ACTIVE";
              const membershipLevel = normalizeUserTypeLevel(membership.userTypeLevel, 3);
              return (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="mb-1 inline-flex rounded bg-muted px-2 py-0.5 text-[11px] font-medium">
                      Level {membershipLevel}
                    </span>
                    <p className="font-medium">
                      {membership.user.name}
                      {isMasterAdmin ? (
                        <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Master Admin</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{membership.user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Role: {getTenantRoleLabel(membership.role)} · Status: {membership.status}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isMasterAdmin ? (
                      <form action={submitChangeMemberRole} className="flex items-center gap-2">
                        <input type="hidden" name="companyId" value={membership.companyId} />
                        <input type="hidden" name="userId" value={membership.userId} />
                        <select name="roleId" defaultValue={membership.roleId ?? ""} className="h-9 rounded-md border border-border bg-transparent px-3">
                          {assignableRoles.map((role) => (
                            <option key={role.id} value={role.id}>{getTenantRoleLabel(role.name)}</option>
                          ))}
                        </select>
                        <select
                          name="userTypeLevel"
                          defaultValue={String(membershipLevel)}
                          className="h-9 rounded-md border border-border bg-transparent px-3"
                        >
                          {editableLevels.map((level) => (
                            <option key={level.value} value={level.value}>{level.label}</option>
                          ))}
                        </select>
                        <Button type="submit" variant="outline">Update role</Button>
                      </form>
                    ) : (
                      <span className="text-xs text-muted-foreground">Transfer Master Admin before role changes</span>
                    )}

                    <form action={submitSetMemberStatus} className="flex items-center gap-2">
                      <input type="hidden" name="companyId" value={membership.companyId} />
                      <input type="hidden" name="userId" value={membership.userId} />
                      <select
                        name="status"
                        defaultValue={membership.status}
                        className="h-9 rounded-md border border-border bg-transparent px-3"
                        disabled={isMasterAdmin}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="INVITED">INVITED</option>
                      </select>
                      <Button type="submit" variant="outline" disabled={isMasterAdmin}>Update status</Button>
                    </form>

                    <form action={submitRemoveMember}>
                      <input type="hidden" name="companyId" value={membership.companyId} />
                      <input type="hidden" name="userId" value={membership.userId} />
                      <Button type="submit" variant="outline" disabled={isMasterAdmin}>Remove</Button>
                    </form>

                    {!isMasterAdmin && membership.status === "ACTIVE" ? (
                      <form action={submitTransferMasterAdmin}>
                        <input type="hidden" name="companyId" value={membership.companyId} />
                        <input type="hidden" name="targetUserId" value={membership.userId} />
                        <Button type="submit" variant="outline">Transfer Master Admin</Button>
                      </form>
                    ) : null}
                  </div>
                  {membershipLevel === 3 && !isMasterAdmin ? (
                    <form action={submitSetMemberPermissionOverrides} className="mt-3 flex w-full items-center gap-2">
                      <input type="hidden" name="companyId" value={membership.companyId} />
                      <input type="hidden" name="userId" value={membership.userId} />
                      <Input
                        name="permissionKeys"
                        placeholder="Comma-separated permission keys (e.g. inventory.item.read,inventory.document.read)"
                      />
                      <Button type="submit" variant="outline">Save permissions</Button>
                    </form>
                  ) : null}
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
