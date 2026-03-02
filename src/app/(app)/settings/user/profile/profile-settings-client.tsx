"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsList } from "@/components/records/settings-list";

type MeResponse = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  uiThemePreference: "LIGHT" | "DARK" | "SYSTEM";
  status: string;
};

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

async function readEnvelope<T>(input: Response): Promise<T> {
  const payload = (await input.json()) as Envelope<T>;
  if (!input.ok || !payload.ok) {
    throw new Error(payload.ok ? "Request failed" : payload.error.message);
  }
  return payload.data;
}

export function ProfileSettingsClient() {
  const queryClient = useQueryClient();
  const { theme = "system", setTheme } = useTheme();
  const profileQuery = useQuery({
    queryKey: ["iam-me"],
    queryFn: async () => readEnvelope<MeResponse>(await fetch("/api/iam/me", { cache: "no-store" })),
  });

  const [form, setForm] = useState({ name: "", phone: "", avatarUrl: "" });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profileQuery.data) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setForm({
        name: profileQuery.data.name,
        phone: profileQuery.data.phone ?? "",
        avatarUrl: profileQuery.data.avatarUrl ?? "",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [profileQuery.data]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          avatarUrl: form.avatarUrl.trim() || null,
        }),
      });
      return readEnvelope<MeResponse>(response);
    },
    onSuccess: async (data) => {
      setMessage("Profile updated.");
      await queryClient.invalidateQueries({ queryKey: ["iam-me"] });
      setForm({ name: data.name, phone: data.phone ?? "", avatarUrl: data.avatarUrl ?? "" });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Failed to update profile");
    },
  });

  const statusVariant = profileQuery.data?.status === "ACTIVE" ? "success" : "warning";
  const themeButtons = useMemo(
    () => [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
      { value: "system", label: "System" },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border border-border shadow-sm">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Settings / User / Profile</p>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Profile</h1>
              </div>
              {profileQuery.data ? <Badge variant={statusVariant}>{profileQuery.data.status}</Badge> : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full Name</Label>
                <Input id="profile-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2" id="email">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" value={profileQuery.data?.email ?? ""} readOnly />
                <p className="text-xs text-muted-foreground">Email changes stay on the secured account flow.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone">Phone</Label>
                <Input id="profile-phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-avatar">Avatar URL</Label>
                <Input id="profile-avatar" value={form.avatarUrl} onChange={(event) => setForm((current) => ({ ...current, avatarUrl: event.target.value }))} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending || profileQuery.isLoading}>
                {saveProfile.isPending ? "Saving..." : "Save Profile"}
              </Button>
              {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            </div>
          </div>
          <div className="space-y-4">
            <div id="app" className="rounded-2xl border border-border bg-[hsl(var(--surface-2))] p-4">
              <p className="text-sm font-semibold text-foreground">Theme</p>
              <p className="mt-1 text-sm text-muted-foreground">Light uses dark text. Dark uses light text. System follows your OS.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {themeButtons.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={theme === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <div id="workspace" className="rounded-2xl border border-border bg-[hsl(var(--surface-2))] p-4">
              <p className="text-sm font-semibold text-foreground">Workspace</p>
              <p className="mt-1 text-sm text-muted-foreground">Default workspace shortcuts, pinned modules, and quick actions remain tenant-scoped.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card id="desk" className="rounded-3xl border border-border shadow-sm">
          <CardContent className="space-y-3 p-5">
            <h2 className="text-lg font-semibold text-foreground">Desk & Navigation</h2>
            <div id="navigation" className="rounded-2xl border border-border bg-[hsl(var(--surface-2))] p-4 text-sm text-muted-foreground">
              Sidebar collapse state persists locally. Use the module switcher to move between workspaces.
            </div>
            <div id="lists" className="rounded-2xl border border-border bg-[hsl(var(--surface-2))] p-4 text-sm text-muted-foreground">
              List density, filters, and row presets follow your active workspace settings.
            </div>
            <div id="forms" className="rounded-2xl border border-border bg-[hsl(var(--surface-2))] p-4 text-sm text-muted-foreground">
              Form defaults, inspector preferences, and sticky fields can be layered here later.
            </div>
          </CardContent>
        </Card>

        <SettingsList
          title="Profile Shortcuts"
          items={[
            { label: "Document Follow", href: "#follows", description: "Notification stubs for watched records." },
            { label: "Email", href: "#email", description: "Primary address and delivery note." },
            { label: "Workspace", href: "#workspace", description: "Workspace defaults." },
            { label: "App", href: "#app", description: "Theme and UI behavior." },
          ]}
        />
      </div>

      <Card id="follows" className="rounded-3xl border border-border shadow-sm">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Follow preferences are placeholder-only in this pass. Wire them to document subscriptions when the backend contract lands.
        </CardContent>
      </Card>
    </div>
  );
}
