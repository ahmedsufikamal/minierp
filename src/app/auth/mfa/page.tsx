"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { enrollMfaAction, verifyMfaAction, verifyMfaRecoveryAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type EnrollState =
  | { error: string }
  | {
      ok: true;
      data: { secret: string; otpauthUri: string; recoveryCodes: string[] };
    };

type VerifyState = { error: string } | undefined;
type RecoveryState = { error: string } | undefined;

const initEnroll: EnrollState = { error: "" };
const initVerify: VerifyState = { error: "" };
const initRecovery: RecoveryState = { error: "" };

export default function MfaPage() {
  const [enrollState, enrollAction] = useActionState(enrollMfaAction, initEnroll);
  const [verifyState, verifyAction] = useActionState(verifyMfaAction, initVerify);
  const [recoveryState, recoveryAction] = useActionState(verifyMfaRecoveryAction, initRecovery);
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.trim() ?? "";

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
            {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
            <Input name="code" placeholder="123456" required />
            <Button type="submit" className="w-full" variant="outline">Verify MFA code</Button>
            {verifyState?.error ? <p className="text-sm text-destructive">{verifyState.error}</p> : null}
          </form>

          <form action={recoveryAction} className="space-y-2">
            {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
            <Input name="code" placeholder="Recovery code" required />
            <Button type="submit" className="w-full" variant="secondary">Use recovery code</Button>
            {recoveryState?.error ? <p className="text-sm text-destructive">{recoveryState.error}</p> : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
