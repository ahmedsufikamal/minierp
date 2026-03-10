"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveOrgSettingsAction, type OrgSettingsActionState } from "@/app/(app)/org/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrgBrandingCard } from "./org-branding-card";

const selectClassName =
  "h-11 w-full rounded-lg border-2 border-input bg-background px-4 text-sm text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary";

type OrgSettingsCompany = {
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
  primaryDomain?: string | null;
  allowedDomains?: unknown;
};

interface OrgSettingsFormProps {
  company: OrgSettingsCompany | null;
  authMethods: string[];
  mfaMode: "OPTIONAL" | "REQUIRED_FOR_ADMINS" | "REQUIRED_FOR_ALL";
  turnstileEnabled: boolean;
}

const initialActionState: OrgSettingsActionState = {};

export function OrgSettingsForm({
  company,
  authMethods,
  mfaMode,
  turnstileEnabled,
}: OrgSettingsFormProps) {
  const [state, formAction, pending] = useActionState(saveOrgSettingsAction, initialActionState);
  const hydrated = true;

  useEffect(() => {
    if (state?.ok) {
      toast.success("Organization settings saved");
      return;
    }

    if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-6" data-testid="org-settings-form" data-hydrated={hydrated ? "true" : "false"}>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Branding</CardTitle>
          <CardDescription>
            Upload the official company logo used in the app header and auth surfaces, then tune colors and typography.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrgBrandingCard
            companyName={company?.name ?? "Current company"}
            initialLogoUrl={company?.logoUrl}
            initialPrimaryColor={company?.primaryColor}
            initialAccentColor={company?.accentColor}
            initialFontFamily={company?.fontFamily}
            disabled={!hydrated || pending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Domains</CardTitle>
          <CardDescription>
            Control which domains identify this company and how tenant branding resolves for hosted experiences.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="org-primary-domain">Primary domain</Label>
            <Input
              id="org-primary-domain"
              name="primaryDomain"
              placeholder="app.customer.com"
              defaultValue={company?.primaryDomain ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-allowed-domains">Allowed domains</Label>
            <Input
              id="org-allowed-domains"
              name="allowedDomains"
              placeholder="customer.com, auth.customer.com"
              defaultValue={Array.isArray(company?.allowedDomains) ? company.allowedDomains.join(", ") : ""}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <p className="text-xs text-muted-foreground">
              Tenant-aware auth branding resolves from these domains after verification is completed.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Authentication policies</CardTitle>
          <CardDescription>
            Choose how users can sign in, enforce MFA, and control bot protection on auth entrypoints.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Allowed auth methods</Label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))/0.72] p-4 text-sm">
                <input type="checkbox" name="auth_password" defaultChecked={authMethods.includes("PASSWORD")} className="mt-1" />
                <span className="space-y-1">
                  <span className="block font-medium text-foreground">Password</span>
                  <span className="block text-xs text-muted-foreground">
                    Standard email and password authentication.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))/0.72] p-4 text-sm">
                <input type="checkbox" name="auth_magic_link" defaultChecked={authMethods.includes("MAGIC_LINK")} className="mt-1" />
                <span className="space-y-1">
                  <span className="block font-medium text-foreground">Magic link</span>
                  <span className="block text-xs text-muted-foreground">
                    Passwordless sign-in from verified email inboxes.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))/0.72] p-4 text-sm">
                <input type="checkbox" name="auth_google" defaultChecked={authMethods.includes("OAUTH_GOOGLE")} className="mt-1" />
                <span className="space-y-1">
                  <span className="block font-medium text-foreground">Google OAuth</span>
                  <span className="block text-xs text-muted-foreground">
                    Allow users to sign in with managed Google accounts.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))/0.72] p-4 text-sm">
                <input type="checkbox" name="auth_microsoft" defaultChecked={authMethods.includes("OAUTH_MICROSOFT")} className="mt-1" />
                <span className="space-y-1">
                  <span className="block font-medium text-foreground">Microsoft OAuth</span>
                  <span className="block text-xs text-muted-foreground">
                    Allow users to sign in with Entra and Microsoft 365 accounts.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,280px)_1fr]">
            <div className="space-y-2">
              <Label htmlFor="org-mfa-mode">MFA policy</Label>
              <select id="org-mfa-mode" name="mfaMode" defaultValue={mfaMode} className={selectClassName}>
                <option value="OPTIONAL">Optional</option>
                <option value="REQUIRED_FOR_ADMINS">Required for owners/admins</option>
                <option value="REQUIRED_FOR_ALL">Required for all users</option>
              </select>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))/0.72] p-4">
              <Label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="turnstileEnabled" defaultChecked={turnstileEnabled} className="mt-1" />
                <span className="space-y-1">
                  <span className="block font-medium text-foreground">Bot protection</span>
                  <span className="block text-xs text-muted-foreground">
                    Enable Turnstile on sign-in and sign-up flows for this company.
                  </span>
                </span>
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-20 flex justify-end">
        <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border)/0.88)] bg-[hsl(var(--surface-1))/0.92] px-4 py-3 shadow-xl backdrop-blur">
          <p className="hidden text-sm text-muted-foreground md:block">
            Branding changes update the workspace header and tenant auth screens after save.
          </p>
          <Button type="submit" disabled={!hydrated || pending}>
            {pending ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </div>
    </form>
  );
}
