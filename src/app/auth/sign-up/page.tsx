"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { signup } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniERPLogo } from "@/components/minierp-logo";

const initialState = { error: "" };

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

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/70 bg-card/95">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MiniERPLogo size="icon" />
          </div>
          <CardTitle className="text-2xl">Create your workspace</CardTitle>
          <CardDescription>Provision your account and initial organization</CardDescription>
        </CardHeader>

        <CardContent>
          <form action={formAction} className="space-y-3">
            <Input name="name" placeholder="Full name" required />
            <Input name="email" type="email" placeholder="you@company.com" required />
            <Input name="companyName" placeholder="Company name" required />
            <Input name="companySlug" placeholder="company-slug" />
            <Input name="password" type="password" placeholder="Strong password (12+ chars)" minLength={12} required />
            {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <SubmitButton />
          </form>
        </CardContent>

        <CardFooter className="justify-center text-sm text-muted-foreground">
          Already registered? <Link className="ml-1 text-foreground underline" href="/auth/sign-in">Sign in</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
