"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signin } from "../auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { MiniERPLogo } from "@/components/minierp-logo";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit" className="w-full font-bold" variant="default">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
    </Button>
  );
}

const initialState = {
  error: "",
};

export default function SignInPage() {
  const [state, formAction] = useActionState(signin, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/15 blur-3xl animate-pulse" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-3xl animate-pulse delay-1000" />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-0 z-10 bg-card/95 backdrop-blur-md">
        <CardHeader className="space-y-1 text-center pb-8 border-b border-border">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/25 text-primary-foreground">
            <MiniERPLogo size="icon" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <label
                className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor="email"
              >
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
                className="bg-background/60"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  htmlFor="password"
                >
                  Password
                </label>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="bg-background/60"
              />
            </div>

            {state?.error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center justify-center">
                {state.error}
              </div>
            )}

            <div className="pt-2">
              <SubmitButton />
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 border-t border-border pt-6">
          <div className="text-sm text-muted-foreground text-center">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="text-foreground font-semibold hover:underline">
              Sign up
            </Link>
          </div>
          <div className="text-xs text-muted-foreground text-center">Secured by Custom Auth</div>
        </CardFooter>
      </Card>
    </div>
  );
}
