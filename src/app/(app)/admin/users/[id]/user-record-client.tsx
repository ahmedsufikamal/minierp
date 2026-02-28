"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InspectorPanel } from "@/components/records/inspector-panel";
import { RecordLayout } from "@/components/records/record-layout";
import { RecordPageHeader } from "@/components/records/page-header";
import { RolesGrid } from "@/components/records/roles-grid";
import { SettingsList } from "@/components/records/settings-list";
import { SessionsTable, type SessionTableItem } from "@/components/records/sessions-table";

type PermissionCatalogGroup = {
  module: string;
  permissions: Array<{ key: string; description: string }>;
};

type MembershipDto = {
  companyId: string;
  companyName: string;
  roleId: string | null;
  role: string;
  userTypeLevel: number;
  userTypeLabel: string | null;
  status: string;
  joinedAt: string | null;
  lastActiveAt: string | null;
  permissionKeys: string[];
};

type UserDetailDto = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  platformRole: "SUPER_ADMIN" | "SUPPORT" | "NONE";
  status: "ACTIVE" | "INVITED" | "SUSPENDED" | "DISABLED";
  activeCompanyId: string | null;
  createdAt: string;
  updatedAt: string;
  memberships: MembershipDto[];
  selectedCompanyId: string | null;
  auditMeta: {
    createdBy: string;
    createdAt: string;
    lastEditedBy: string;
    lastEditedAt: string;
  };
};

type RolesDto = {
  roles: Array<{ id: string; name: string; description: string | null; isSystem: boolean; isDefault: boolean }>;
  permissionCatalog: PermissionCatalogGroup[];
};

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

type EditableFormState = {
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  status: UserDetailDto["status"];
  platformRole: UserDetailDto["platformRole"];
};

async function readEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as Envelope<T>;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Request failed" : payload.error.message);
  }
  return payload.data;
}

function resolveInitials(name: string, email: string): string {
  const fromName = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return fromName || email.slice(0, 1).toUpperCase();
}

function formatTimestamp(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function AdminUserRecordClient({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("details");
  const [form, setForm] = useState<EditableFormState>({
    name: "",
    email: "",
    phone: "",
    avatarUrl: "",
    status: "ACTIVE",
    platformRole: "NONE",
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [roleId, setRoleId] = useState<string>("");
  const [userTypeLevel, setUserTypeLevel] = useState<number>(3);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  const userQuery = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: async () => readEnvelope<UserDetailDto>(await fetch(`/api/iam/admin/users/${userId}`, { cache: "no-store" })),
  });

  useEffect(() => {
    if (!userQuery.data) return;
    setForm({
      name: userQuery.data.name,
      email: userQuery.data.email,
      phone: userQuery.data.phone ?? "",
      avatarUrl: userQuery.data.avatarUrl ?? "",
      status: userQuery.data.status,
      platformRole: userQuery.data.platformRole,
    });
    const membership = userQuery.data.memberships.find((entry) => entry.companyId === userQuery.data.selectedCompanyId) ?? userQuery.data.memberships[0];
    if (membership) {
      setSelectedCompanyId(membership.companyId);
      setRoleId(membership.roleId ?? "");
      setUserTypeLevel(membership.userTypeLevel);
      setPermissionKeys(membership.permissionKeys);
    }
  }, [userQuery.data]);

  const currentMembership = useMemo(
    () => userQuery.data?.memberships.find((entry) => entry.companyId === selectedCompanyId) ?? null,
    [selectedCompanyId, userQuery.data],
  );

  useEffect(() => {
    if (!currentMembership) return;
    setRoleId(currentMembership.roleId ?? "");
    setUserTypeLevel(currentMembership.userTypeLevel);
    setPermissionKeys(currentMembership.permissionKeys);
  }, [currentMembership]);

  const rolesQuery = useQuery({
    queryKey: ["admin-user-roles", selectedCompanyId],
    enabled: Boolean(selectedCompanyId),
    queryFn: async () => readEnvelope<RolesDto>(await fetch(`/api/iam/admin/roles?companyId=${encodeURIComponent(selectedCompanyId)}`, { cache: "no-store" })),
  });

  const sessionsQuery = useQuery({
    queryKey: ["admin-user-sessions", userId],
    queryFn: async () => readEnvelope<{ sessions: SessionTableItem[] }>(await fetch(`/api/iam/admin/users/${userId}/sessions`, { cache: "no-store" })),
  });

  const saveDetails = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/iam/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          avatarUrl: form.avatarUrl.trim() || null,
          status: form.status,
          platformRole: form.platformRole,
        }),
      });
      return readEnvelope<unknown>(response);
    },
    onSuccess: async () => {
      setNotice("User details saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to save user"),
  });

  const saveRoles = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/iam/admin/users/${userId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ companyId: selectedCompanyId, roleId, userTypeLevel, permissionKeys }),
      });
      return readEnvelope<unknown>(response);
    },
    onSuccess: async () => {
      setNotice("Membership access updated.");
      await queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to save membership"),
  });

  const revokeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      setPendingSessionId(sessionId);
      const response = await fetch(`/api/iam/admin/users/${userId}/sessions/${sessionId}/revoke`, {
        method: "POST",
        credentials: "same-origin",
      });
      return readEnvelope<{ revoked: boolean }>(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-user-sessions", userId] });
    },
    onSettled: () => setPendingSessionId(null),
  });

  const forceReset = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}/force-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason: "Admin initiated password reset" }),
      });
      return readEnvelope<{ forced: boolean }>(response);
    },
    onSuccess: () => setNotice("Password reset enforced."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to force reset"),
  });

  const tabs = [
    { value: "details", label: "User Details" },
    { value: "roles", label: "Roles & Permissions" },
    { value: "more", label: "More Information" },
    { value: "settings", label: "Settings" },
    { value: "connections", label: "Connections" },
    { value: "sessions", label: "Sessions" },
  ];

  const canSave = activeTab === "details" || activeTab === "roles" || activeTab === "more";
  const saveBusy = saveDetails.isPending || saveRoles.isPending;

  const detail = userQuery.data;
  const roles = rolesQuery.data;
  const sessions = sessionsQuery.data?.sessions ?? [];

  const headerActions = (
    <>
      <Button type="button" variant="outline" onClick={() => setActiveTab("roles")}>
        <ShieldCheck className="mr-2 h-4 w-4" />
        Permissions
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline">Password</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-2xl border border-border bg-popover p-1.5">
          <DropdownMenuItem onClick={() => forceReset.mutate()}>
            Force password reset
          </DropdownMenuItem>
          <DropdownMenuItem disabled>Set temporary password</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button type="button" variant="outline" disabled>Create User Email</Button>
      <Button
        type="button"
        onClick={() => {
          if (activeTab === "roles") {
            saveRoles.mutate();
            return;
          }
          saveDetails.mutate();
        }}
        disabled={!canSave || saveBusy || userQuery.isLoading}
      >
        {saveBusy ? "Saving..." : "Save"}
      </Button>
    </>
  );

  const main = detail ? (
    <div className="space-y-5">
      {notice ? <div className="rounded-2xl border border-border bg-[hsl(var(--surface-2))] px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}
      {activeTab === "details" ? (
        <Card className="rounded-3xl border border-border shadow-sm">
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">Full Name</Label>
              <Input id="user-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-status">Enabled</Label>
              <select
                id="user-status"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EditableFormState["status"] }))}
                className="h-11 w-full rounded-lg border-2 border-input bg-background px-4 text-sm text-foreground"
              >
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="INVITED">Invited</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-role">Platform Role</Label>
              <select
                id="platform-role"
                value={form.platformRole}
                onChange={(event) => setForm((current) => ({ ...current, platformRole: event.target.value as EditableFormState["platformRole"] }))}
                className="h-11 w-full rounded-lg border-2 border-input bg-background px-4 text-sm text-foreground"
              >
                <option value="NONE">NONE</option>
                <option value="SUPPORT">SUPPORT</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "roles" ? (
        <div className="space-y-5">
          <Card className="rounded-3xl border border-border shadow-sm">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="company-context">Company Context</Label>
                <select id="company-context" value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)} className="h-11 w-full rounded-lg border-2 border-input bg-background px-4 text-sm text-foreground">
                  {detail.memberships.map((membership) => (
                    <option key={membership.companyId} value={membership.companyId}>{membership.companyName}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-context">Role</Label>
                <select id="role-context" value={roleId} onChange={(event) => setRoleId(event.target.value)} className="h-11 w-full rounded-lg border-2 border-input bg-background px-4 text-sm text-foreground">
                  {roles?.roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="level-context">User Level</Label>
                <select id="level-context" value={String(userTypeLevel)} onChange={(event) => setUserTypeLevel(Number(event.target.value))} className="h-11 w-full rounded-lg border-2 border-input bg-background px-4 text-sm text-foreground">
                  {[2, 3, 4, 5, 9].map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
          <RolesGrid groups={roles?.permissionCatalog ?? []} selectedKeys={permissionKeys} onChange={setPermissionKeys} disabled={!roles} />
          <Card className="rounded-3xl border border-border shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold text-foreground">Allow Modules</h2>
              <p className="mt-2 text-sm text-muted-foreground">Module-level allow lists are intentionally left as a placeholder until the backend contract is formalized.</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "more" ? (
        <Card className="rounded-3xl border border-border shadow-sm">
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-phone">Phone</Label>
              <Input id="user-phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-avatar">Avatar URL</Label>
              <Input id="user-avatar" value={form.avatarUrl} onChange={(event) => setForm((current) => ({ ...current, avatarUrl: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Input value="" readOnly placeholder="Placeholder" />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value="" readOnly placeholder="Placeholder" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Bio</Label>
              <textarea className="min-h-28 w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm text-foreground" placeholder="Placeholder" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "settings" ? (
        <SettingsList
          title="User Settings"
          items={[
            { label: "Desk Settings", href: "/settings/user/profile#desk", description: "Open personal desk settings." },
            { label: "Security Settings", href: "/settings/user/security", description: "Open security settings." },
            { label: "API Access", href: "/settings/user/api", description: "Open API access." },
          ]}
        />
      ) : null}

      {activeTab === "connections" ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "Profile", description: "User-facing profile view placeholder." },
            { title: "Logs", description: "Activity logs placeholder." },
            { title: "Integrations", description: "Integration bindings placeholder." },
            { title: "Settings", description: "Connection preferences placeholder." },
          ].map((card) => (
            <Card key={card.title} className="rounded-3xl border border-border shadow-sm">
              <CardContent className="space-y-2 p-5">
                <h2 className="text-base font-semibold text-foreground">{card.title}</h2>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {activeTab === "sessions" ? (
        <SessionsTable
          sessions={sessions}
          emptyLabel={sessionsQuery.isLoading ? "Loading sessions..." : "No active sessions."}
          revokePendingId={pendingSessionId}
          onRevoke={(sessionId) => revokeSession.mutate(sessionId)}
        />
      ) : null}
    </div>
  ) : (
    <Card className="rounded-3xl border border-border shadow-sm"><CardContent className="p-5 text-sm text-muted-foreground">Loading user record...</CardContent></Card>
  );

  const inspector = detail ? (
    <InspectorPanel
      title={detail.name}
      subtitle={detail.email}
      avatarUrl={detail.avatarUrl}
      initials={resolveInitials(detail.name, detail.email)}
      quickActions={[
        { label: "Assign", disabled: true },
        { label: "Attachments", disabled: true },
        { label: "Tags", disabled: true },
        { label: "Share", disabled: true },
      ]}
      meta={[
        { label: "Created By", value: detail.auditMeta.createdBy },
        { label: "Created At", value: formatTimestamp(detail.auditMeta.createdAt) },
        { label: "Last Edited By", value: detail.auditMeta.lastEditedBy },
        { label: "Last Edited At", value: formatTimestamp(detail.auditMeta.lastEditedAt) },
      ]}
    />
  ) : null;

  return (
    <div className="space-y-5">
      <RecordPageHeader
        breadcrumbs={
          <span className="inline-flex items-center gap-2">
            <Link href="/admin/users" className="hover:text-foreground">Users</Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span>{detail?.name || "Loading"}</span>
          </span>
        }
        title={detail?.name || "Loading user"}
        subtitle="Company-scoped membership access is managed per selected workspace context."
        status={{
          label: detail ? (detail.status === "ACTIVE" ? "Active" : detail.status) : "Loading",
          variant: detail?.status === "ACTIVE" ? "success" : "warning",
        }}
        actions={headerActions}
      />
      <RecordLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} main={main} inspector={inspector} />
    </div>
  );
}
