"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { resetPasswordAction } from "@/app/auth-actions";
import { ActionErrorMessage } from "@/components/auth/action-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthActionError } from "@/modules/iam/interface/action-error";

const initialState: { error?: AuthActionError } = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Reset password
    </Button>
  );
}

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);
  const searchParams = useSearchParams();
  const email = searchParams.get("email")?.trim() ?? "";
  const nextPath = searchParams.get("next")?.trim() ?? "";

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/70 bg-card/95">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription>
            This account requires a password reset before continuing.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form action={formAction} className="space-y-3">
            <Input
              name="email"
              type="email"
              placeholder="you@company.com"
              defaultValue={email}
              required
            />
            <Input name="currentPassword" type="password" placeholder="Current password" required />
            <Input name="newPassword" type="password" placeholder="New strong password" minLength={12} required />
            {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
            <ActionErrorMessage error={state?.error} />
            <SubmitButton />
          </form>
        </CardContent>

        <CardFooter className="justify-center text-sm text-muted-foreground">
          Back to <Link className="ml-1 text-foreground underline" href="/auth/sign-in">sign in</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
