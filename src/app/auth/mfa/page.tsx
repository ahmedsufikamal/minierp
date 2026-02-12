"use client";

import { useActionState } from "react";
import { enrollMfaAction, verifyMfaAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initEnroll = { error: "", ok: false as boolean, data: null as null | { otpauthUri: string; recoveryCodes: string[] } };
const initVerify = { error: "", ok: false as boolean };

export default function MfaPage() {
  const [enrollState, enrollAction] = useActionState(enrollMfaAction, initEnroll);
  const [verifyState, verifyAction] = useActionState(verifyMfaAction, initVerify);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Multi-factor authentication</CardTitle>
          <CardDescription>Enroll authenticator app and verify a one-time code.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={enrollAction} className="space-y-2">
            <Input name="label" placeholder="Device label (optional)" />
            <Button type="submit" className="w-full">Enroll TOTP</Button>
            {enrollState?.error ? <p className="text-sm text-destructive">{enrollState.error}</p> : null}
          </form>

          {enrollState?.data ? (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Use this OTPAuth URI in your authenticator app:</p>
              <p className="break-all text-xs text-muted-foreground">{enrollState.data.otpauthUri}</p>
              <p className="text-sm font-medium">Recovery codes:</p>
              <ul className="grid grid-cols-2 gap-1 text-xs">
                {enrollState.data.recoveryCodes.map((code) => (
                  <li key={code} className="rounded bg-muted px-2 py-1 font-mono">
                    {code}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form action={verifyAction} className="space-y-2">
            <Input name="code" placeholder="123456" required />
            <Button type="submit" className="w-full" variant="outline">Verify MFA code</Button>
            {verifyState?.ok ? <p className="text-sm text-emerald-600">MFA verified. You can continue.</p> : null}
            {verifyState?.error ? <p className="text-sm text-destructive">{verifyState.error}</p> : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
