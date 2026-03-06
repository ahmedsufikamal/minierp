"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signin, sendMagicLinkAction } from "@/app/auth-actions";
import { ActionErrorMessage } from "@/components/auth/action-error-message";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniERPLogo } from "@/components/minierp-logo";
import type { AuthActionError } from "@/modules/iam/interface/action-error";

const initialState: { error?: AuthActionError } = {};
type MagicState = { error?: AuthActionError; ok?: true };
const initialMagic: MagicState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}

export default function AuthSignInPage() {
  const [state, formAction] = useActionState(signin, initialState);
  const [magicState, magicAction] = useActionState(sendMagicLinkAction, initialMagic);
  const [allowedAuthMethods, setAllowedAuthMethods] = useState<string[]>([
    "PASSWORD",
    "MAGIC_LINK",
  ]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.trim() ?? "";
  const passwordResetDone = searchParams.get("passwordReset") === "1";

  useEffect(() => {
    void fetch("/api/auth/config")
      .then((r) => r.json())
      .then((payload: { data?: { allowedAuthMethods?: string[]; logoUrl?: string | null } }) => {
        const methods = payload.data?.allowedAuthMethods;
        if (Array.isArray(methods) && methods.length > 0) {
          setAllowedAuthMethods(methods);
        }
        setLogoUrl(payload.data?.logoUrl ?? null);
      })
      .catch(() => undefined);
  }, []);

  const passwordEnabled = allowedAuthMethods.includes("PASSWORD");
  const magicEnabled = allowedAuthMethods.includes("MAGIC_LINK");

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/70 bg-card/95">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Tenant logo" className="h-7 w-7 rounded-sm object-contain" />
            ) : (
              <MiniERPLogo size="icon" />
            )}
          </div>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>Access your tenant workspace securely</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {passwordResetDone ? (
            <p className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-500">
              Password reset complete. Sign in with your new password.
            </p>
          ) : null}
          {passwordEnabled ? (
            <form action={formAction} className="space-y-3">
              {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
              <Input name="email" type="email" placeholder="you@company.com" required />
              <Input name="password" type="password" placeholder="Password" required />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="rememberMe" /> Remember me
              </label>
              <TurnstileField />
              <ActionErrorMessage error={state?.error} />
              <SubmitButton label="Sign in with password" />
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Password sign-in is disabled for this tenant.</p>
          )}

          {magicEnabled ? (
            <div className="rounded-lg border border-border p-3">
              <form action={magicAction} className="space-y-2">
                <Input name="email" type="email" placeholder="Email for magic link" required />
                <input type="hidden" name="redirectTo" value={nextPath || "/dashboard"} />
                <TurnstileField />
                <SubmitButton label="Send magic link" />
                <ActionErrorMessage error={magicState?.error} />
                {"ok" in magicState && magicState.ok ? <p className="text-sm text-emerald-600">Magic link sent. Check your inbox.</p> : null}
              </form>
            </div>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            Need mandatory reset? <Link className="underline" href="/auth/reset-password">Reset password</Link>
          </p>
        </CardContent>

        <CardFooter className="justify-center text-sm text-muted-foreground">
          Don&apos;t have an account? <Link className="ml-1 text-foreground underline" href="/auth/sign-up">Sign up</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
