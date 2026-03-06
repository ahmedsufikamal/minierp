"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signup } from "@/app/auth-actions";
import { ActionErrorMessage } from "@/components/auth/action-error-message";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniERPLogo } from "@/components/minierp-logo";
import type { AuthActionError } from "@/modules/iam/interface/action-error";

const initialState: { error?: AuthActionError } = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Create account
    </Button>
  );
}

export default function AuthSignUpPage() {
  const [state, formAction] = useActionState(signup, initialState);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [passwordEnabled, setPasswordEnabled] = useState(true);
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() ?? "";
  const nextPath = searchParams.get("next")?.trim() ?? "";
  const hasInviteToken = inviteToken.length >= 16;

  useEffect(() => {
    void fetch("/api/auth/config")
      .then((r) => r.json())
      .then((payload: { data?: { allowedAuthMethods?: string[]; logoUrl?: string | null } }) => {
        const methods = payload.data?.allowedAuthMethods;
        if (Array.isArray(methods) && methods.length > 0) {
          setPasswordEnabled(methods.includes("PASSWORD"));
        }
        setLogoUrl(payload.data?.logoUrl ?? null);
      })
      .catch(() => undefined);
  }, []);

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
          <CardTitle className="text-2xl">{hasInviteToken ? "Accept invitation" : "Create your workspace"}</CardTitle>
          <CardDescription>
            {hasInviteToken ? "Create your account to join the invited organization." : "Provision your account and initial organization"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {passwordEnabled ? (
            <form action={formAction} className="space-y-3">
              {hasInviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}
              {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
              <Input name="name" placeholder="Full name" required />
              <Input name="email" type="email" placeholder="you@company.com" required />
              {!hasInviteToken ? <Input name="companyName" placeholder="Company name" required /> : null}
              {!hasInviteToken ? <Input name="companySlug" placeholder="company-slug" /> : null}
              <Input name="password" type="password" placeholder="Strong password (12+ chars)" minLength={12} required />
              <TurnstileField />
              <ActionErrorMessage error={state?.error} />
              <SubmitButton />
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Sign-up is currently disabled for this tenant.</p>
          )}
        </CardContent>

        <CardFooter className="justify-center text-sm text-muted-foreground">
          Already registered? <Link className="ml-1 text-foreground underline" href="/auth/sign-in">Sign in</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
