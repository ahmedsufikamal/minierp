"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signin, sendMagicLinkAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniERPLogo } from "@/components/minierp-logo";

const initialState = { error: "" };
type MagicState = { error: string } | { ok: true };
const initialMagic: MagicState = { error: "" };

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
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.trim() ?? "";

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/70 bg-card/95">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MiniERPLogo size="icon" />
          </div>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>Access your tenant workspace securely</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <form action={formAction} className="space-y-3">
            {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
            <Input name="email" type="email" placeholder="you@company.com" required />
            <Input name="password" type="password" placeholder="Password" required />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="rememberMe" /> Remember me
            </label>
            {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <SubmitButton label="Sign in with password" />
          </form>

          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline">
              <a href="/api/auth/oauth/google/start">Continue with Google</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/api/auth/oauth/microsoft/start">Continue with Microsoft</a>
            </Button>
          </div>

          <div className="rounded-lg border border-border p-3">
            <form action={magicAction} className="space-y-2">
              <Input name="email" type="email" placeholder="Email for magic link" required />
              <input type="hidden" name="redirectTo" value={nextPath || "/dashboard"} />
              <SubmitButton label="Send magic link" />
              {"error" in magicState && magicState.error ? <p className="text-sm text-destructive">{magicState.error}</p> : null}
              {"ok" in magicState && magicState.ok ? <p className="text-sm text-emerald-600">Magic link sent. Check your inbox.</p> : null}
            </form>
          </div>
        </CardContent>

        <CardFooter className="justify-center text-sm text-muted-foreground">
          Don&apos;t have an account? <Link className="ml-1 text-foreground underline" href="/auth/sign-up">Sign up</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
