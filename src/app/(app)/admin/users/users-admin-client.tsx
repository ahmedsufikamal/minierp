"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type UserListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  platformRole: "SUPER_ADMIN" | "SUPPORT" | "NONE";
  status: "ACTIVE" | "INVITED" | "SUSPENDED" | "DISABLED";
  activeCompanyId: string | null;
  createdAt: string;
  memberships: Array<{
    companyId: string;
    role: string;
    status: string;
    companyName: string;
  }>;
};

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

async function readEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as Envelope<T>;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Request failed" : payload.error.message);
  }
  return payload.data;
}

export function AdminUsersClient() {
  const [draftQuery, setDraftQuery] = useState("");
  const [filters, setFilters] = useState({ query: "", platformRole: "ALL", status: "ALL" });

  const params = useMemo(() => new URLSearchParams({
    query: filters.query,
    platformRole: filters.platformRole,
    status: filters.status,
  }), [filters]);

  const usersQuery = useQuery({
    queryKey: ["admin-users", filters],
    queryFn: async () => readEnvelope<{ items: UserListItem[] }>(await fetch(`/api/iam/admin/users?${params.toString()}`, { cache: "no-store" })),
  });

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border border-border shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Admin / Users</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Users</h1>
              <p className="text-sm text-muted-foreground">Platform-admin visibility across user records and membership contexts.</p>
            </div>
            <Button type="button" variant="outline" disabled>
              Create User
            </Button>
          </div>

          <form
            className="grid gap-4 rounded-2xl border border-border bg-[hsl(var(--surface-2))] p-4 lg:grid-cols-[minmax(0,1fr),220px,220px,auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              setFilters({
                query: String(formData.get("query") || "").trim(),
                platformRole: String(formData.get("platformRole") || "ALL"),
                status: String(formData.get("status") || "ALL"),
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="users-query">Search</Label>
              <Input id="users-query" name="query" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Name, email, phone, or ID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="users-platform-role">Platform Role</Label>
              <select id="users-platform-role" name="platformRole" defaultValue={filters.platformRole} className="h-11 w-full rounded-lg border-2 border-input bg-background px-4 text-sm text-foreground">
                <option value="ALL">All roles</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                <option value="SUPPORT">SUPPORT</option>
                <option value="NONE">NONE</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="users-status">Status</Label>
              <select id="users-status" name="status" defaultValue={filters.status} className="h-11 w-full rounded-lg border-2 border-input bg-background px-4 text-sm text-foreground">
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INVITED">INVITED</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit">Apply Filters</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-3xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Memberships</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(usersQuery.data?.items ?? []).map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{user.platformRole}</Badge></TableCell>
                <TableCell><Badge variant={user.status === "ACTIVE" ? "success" : "warning"}>{user.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.memberships.slice(0, 3).map((membership) => (
                      <Badge key={`${user.id}-${membership.companyId}`} variant="secondary">
                        {membership.companyName} · {membership.role}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/users/${user.id}`}>Open</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!usersQuery.isLoading && !(usersQuery.data?.items.length) ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No users matched the current filters.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
