"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signup } from "../auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { Loader2 } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit" className="w-full font-bold" variant="dark">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create account"}
    </Button>
  );
}

const initialState = {
  error: "",
};

export default function SignUpPage() {
  const [state, formAction] = useActionState(signup, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-3xl animate-pulse" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-purple-400/20 blur-3xl animate-pulse delay-1000" />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-0 z-10 bg-white/80 backdrop-blur-md">
        <CardHeader className="space-y-1 text-center pb-8 border-b border-slate-100">
          <div className="mx-auto h-12 w-12 rounded-xl bg-slate-900 flex items-center justify-center mb-4 shadow-lg shadow-slate-900/20">
             <div className="text-white font-bold text-xl">mE</div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Create an account</CardTitle>
          <CardDescription>Enter your email below to create your account</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <form action={formAction} className="space-y-4">
             <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="name">
                Full Name
              </label>
              <Input id="name" name="name" placeholder="John Doe" required className="bg-white/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="email">
                Email
              </label>
              <Input id="email" name="email" type="email" placeholder="name@example.com" required className="bg-white/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="password">
                Password
              </label>
              <Input id="password" name="password" type="password" required className="bg-white/50" minLength={8} />
            </div>
            
            {state?.error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center">
                {state.error}
              </div>
            )}
            
            <div className="pt-2">
               <SubmitButton />
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 border-t border-slate-100 pt-6">
          <div className="text-sm text-slate-500 text-center">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-slate-900 font-semibold hover:underline">
              Sign in
            </Link>
          </div>
           <div className="text-xs text-slate-400 text-center">
            Secured by Custom Auth
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
