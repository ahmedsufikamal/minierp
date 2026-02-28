"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

async function readEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as Envelope<T>;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Request failed" : payload.error.message);
  }
  return payload.data;
}

export function SecuritySettingsClient() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const changePassword = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/account/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return readEnvelope<{ changed: boolean }>(response);
    },
    onSuccess: () => {
      setMessage("Password updated. Other sessions were revoked.");
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Unable to update password");
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Settings / User / Security</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Security Settings</h1>
        <p className="text-sm text-muted-foreground">Password hygiene, MFA posture, and secure account recovery.</p>
      </div>

      <Card id="password" className="rounded-3xl border border-border shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
            <p className="text-sm text-muted-foreground">This immediately revokes other active sessions.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => changePassword.mutate()} disabled={changePassword.isPending || !currentPassword || !newPassword}>
              {changePassword.isPending ? "Updating..." : "Update Password"}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="rounded-3xl border border-border shadow-sm">
          <CardContent className="space-y-3 p-5">
            <h2 className="text-lg font-semibold text-foreground">Multi-factor Authentication</h2>
            <p className="text-sm text-muted-foreground">MFA enrollment details stay in the IAM flow. This screen surfaces the action entry points.</p>
            <div className="rounded-2xl border border-border bg-[hsl(var(--surface-2))] p-4 text-sm text-muted-foreground">
              Authenticator apps, recovery codes, and step-up verification are managed from the MFA center.
            </div>
            <Button asChild variant="outline"><Link href="/auth/mfa">Open MFA Center</Link></Button>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border shadow-sm">
          <CardContent className="space-y-3 p-5">
            <h2 className="text-lg font-semibold text-foreground">Recovery</h2>
            <p className="text-sm text-muted-foreground">Recovery workflows remain placeholder-only in this pass.</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Primary recovery email confirmation</li>
              <li>Trusted device review</li>
              <li>Step-up prompt timeout policy</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
