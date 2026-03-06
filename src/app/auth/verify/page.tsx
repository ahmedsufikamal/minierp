"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { verifyMagicLinkAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatAuthActionError, type AuthActionError } from "@/modules/iam/interface/action-error";

type VerifyMagicLinkResult = {
  error?: AuthActionError;
};

export default function VerifyAuthPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const type = searchParams.get("type") ?? "";

  const [message, setMessage] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [otp, setOtp] = useState("");
  const [destination, setDestination] = useState("");

  useEffect(() => {
    if (type === "magic-link" && token) {
      const fd = new FormData();
      fd.set("token", token);
      startTransition(async () => {
        const result = (await verifyMagicLinkAction({}, fd)) as VerifyMagicLinkResult;
        if (result.error) {
          setMessage(formatAuthActionError(result.error));
        }
      });
    }
  }, [type, token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify account</CardTitle>
          <CardDescription>Complete magic-link or OTP verification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async (formData) => {
              const result = (await verifyMagicLinkAction({}, formData)) as VerifyMagicLinkResult;
              if (result.error) {
                setMessage(formatAuthActionError(result.error));
              }
            }}
            className="space-y-2"
          >
            <Input name="token" defaultValue={token} placeholder="Magic link token" required />
            <Button type="submit" className="w-full" disabled={pending}>Verify magic link token</Button>
          </form>

          <div className="space-y-2 rounded-lg border p-3">
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Email/phone for OTP"
            />
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="OTP code" />
            <Button
              className="w-full"
              variant="outline"
              onClick={async () => {
                const response = await fetch("/api/auth/otp/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ destination, code: otp, purpose: "SIGN_IN" }),
                });
                if (!response.ok) {
                  const payload = await response.json().catch(() => ({ error: { message: "OTP verification failed" } }));
                  setMessage(payload.error?.message || "OTP verification failed");
                  return;
                }
                setMessage("OTP verified. Continue to dashboard.");
              }}
              disabled={!destination || !otp}
            >
              Verify OTP
            </Button>
          </div>

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
