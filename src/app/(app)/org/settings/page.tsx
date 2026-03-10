import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage } from "@/modules/iam";
import {
  deleteAutoJoinRuleAction,
  generateDomainVerificationTokenAction,
  upsertAutoJoinRuleAction,
  verifyDomainAction,
} from "@/app/(app)/org/actions";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrgSettingsForm } from "./org-settings-form";

const selectClassName =
  "h-11 w-full rounded-lg border-2 border-input bg-background px-4 text-sm text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary";

function normalizeMfaMode(value: string): "OPTIONAL" | "REQUIRED_FOR_ADMINS" | "REQUIRED_FOR_ALL" {
  if (value === "REQUIRED_FOR_ADMINS" || value === "REQUIRED_FOR_ALL") {
    return value;
  }
  return "OPTIONAL";
}

export default async function OrgSettingsPage() {
  const principal = await requirePermissionPage("admin.settings", "/org/settings");

  const company = await prisma.company.findUnique({
    where: { id: principal.activeCompanyId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      primaryColor: true,
      accentColor: true,
      fontFamily: true,
      primaryDomain: true,
      allowedDomains: true,
      domainVerificationStatus: true,
      domainVerificationToken: true,
      domainVerificationGeneratedAt: true,
      allowedAuthMethods: true,
      mfaPolicy: true,
      botProtectionPolicy: true,
    },
  });
  const autoJoinRules = await prisma.iamAutoJoinRule.findMany({
    where: { companyId: principal.activeCompanyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      ruleType: true,
      config: true,
      isEnabled: true,
      updatedAt: true,
    },
  });

  const authMethods = (company?.allowedAuthMethods as string[] | null) ?? [];
  const mfaMode = normalizeMfaMode(
    String((company?.mfaPolicy as { mode?: string } | null)?.mode ?? "OPTIONAL"),
  );
  const turnstileEnabled = Boolean(
    (company?.botProtectionPolicy as { turnstileEnabled?: boolean } | null)?.turnstileEnabled ?? false,
  );
  const submitUpsertAutoJoinRule = async (formData: FormData) => {
    "use server";
    await upsertAutoJoinRuleAction(formData);
  };
  const submitDeleteAutoJoinRule = async (formData: FormData) => {
    "use server";
    await deleteAutoJoinRuleAction(formData);
  };
  const submitGenerateDomainToken = async () => {
    "use server";
    await generateDomainVerificationTokenAction();
  };
  const submitVerifyDomain = async (formData: FormData) => {
    "use server";
    await verifyDomainAction(formData);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Organization settings"
        subtitle="Branding, domains, and authentication policies for the active company."
      />

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Company numbering</CardTitle>
            <CardDescription>
              Manage SKU and document code formats for this company from the dedicated numbering workspace.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/org/settings/company-numbering">Open company numbering</Link>
          </Button>
        </CardHeader>
      </Card>

      <OrgSettingsForm
        company={company}
        authMethods={authMethods}
        mfaMode={mfaMode}
        turnstileEnabled={turnstileEnabled}
      />

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Domain verification</CardTitle>
            <CardDescription>
              Generate a TXT token, publish it in DNS, then verify ownership for trusted company domains.
            </CardDescription>
          </div>
          <form action={submitGenerateDomainToken}>
            <Button type="submit" variant="outline">
              Generate verification token
            </Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-4">
          {company?.domainVerificationToken ? (
            <div className="space-y-2 rounded-2xl border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-2))/0.68] p-4 text-sm">
              <p>
                TXT host:{" "}
                <span className="font-mono text-xs">
                  _minierp-verify.{company.primaryDomain ?? "your-domain.com"}
                </span>
              </p>
              <p>
                TXT value:{" "}
                <span className="break-all font-mono text-xs">{company.domainVerificationToken}</span>
              </p>
              {company.domainVerificationGeneratedAt ? (
                <p className="text-xs text-muted-foreground">
                  Generated at: {new Date(company.domainVerificationGeneratedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--border)/0.85)] bg-[hsl(var(--surface-1))/0.62] p-4 text-sm text-muted-foreground">
              No verification token generated yet.
            </div>
          )}

          <form action={submitVerifyDomain} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <Input name="domainVerificationToken" placeholder="Paste verification token" />
            <Button type="submit" variant="outline">Verify domain</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Auto-join rules</CardTitle>
          <CardDescription>
            Define how users can automatically join this company when their email or domain matches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form action={submitUpsertAutoJoinRule} className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="autojoin-rule-type">Rule type</Label>
              <select id="autojoin-rule-type" name="ruleType" className={selectClassName}>
                <option value="VERIFIED_DOMAIN">Verified domain</option>
                <option value="EMAIL_ALLOWLIST">Email allowlist</option>
                <option value="MANUAL_APPROVAL">Manual approval</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="autojoin-domains">Domains</Label>
              <Input
                id="autojoin-domains"
                name="domains"
                placeholder="acme.com, sub.acme.com"
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="autojoin-allowlist">Allowlist emails</Label>
              <Input
                id="autojoin-allowlist"
                name="allowlist"
                placeholder="ceo@acme.com, ops@acme.com"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="requireAdminApproval" />
              Require admin approval
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="isEnabled" defaultChecked />
              Enabled
            </label>
            <div className="lg:col-span-2">
              <Button type="submit" variant="outline">Add rule</Button>
            </div>
          </form>

          <div className="space-y-3">
            {autoJoinRules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[hsl(var(--border)/0.85)] bg-[hsl(var(--surface-1))/0.62] p-4 text-sm text-muted-foreground">
                No auto-join rules configured.
              </div>
            ) : (
              autoJoinRules.map((rule) => {
                const config = (
                  rule.config as {
                    domains?: string[];
                    allowlist?: string[];
                    requireAdminApproval?: boolean;
                  } | null
                ) ?? {};

                return (
                  <div
                    key={rule.id}
                    className="rounded-2xl border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-1))/0.7] p-4"
                  >
                    <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <p className="font-medium text-foreground">Rule: {rule.ruleType}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated: {new Date(rule.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <form action={submitUpsertAutoJoinRule} className="grid gap-3 lg:grid-cols-2">
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <div className="space-y-2">
                        <Label htmlFor={`rule-type-${rule.id}`}>Rule type</Label>
                        <select
                          id={`rule-type-${rule.id}`}
                          name="ruleType"
                          defaultValue={rule.ruleType}
                          className={selectClassName}
                        >
                          <option value="VERIFIED_DOMAIN">Verified domain</option>
                          <option value="EMAIL_ALLOWLIST">Email allowlist</option>
                          <option value="MANUAL_APPROVAL">Manual approval</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`rule-domains-${rule.id}`}>Domains</Label>
                        <Input
                          id={`rule-domains-${rule.id}`}
                          name="domains"
                          defaultValue={config.domains?.join(", ") ?? ""}
                          placeholder="Domains (comma-separated)"
                        />
                      </div>
                      <div className="space-y-2 lg:col-span-2">
                        <Label htmlFor={`rule-allowlist-${rule.id}`}>Allowlist emails</Label>
                        <Input
                          id={`rule-allowlist-${rule.id}`}
                          name="allowlist"
                          defaultValue={config.allowlist?.join(", ") ?? ""}
                          placeholder="Allowlist emails (comma-separated)"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          name="requireAdminApproval"
                          defaultChecked={Boolean(config.requireAdminApproval)}
                        />
                        Require admin approval
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" name="isEnabled" defaultChecked={rule.isEnabled} />
                        Enabled
                      </label>
                      <div className="flex flex-wrap gap-2 lg:col-span-2">
                        <Button type="submit" variant="outline" size="sm">Save rule</Button>
                      </div>
                    </form>
                    <form action={submitDeleteAutoJoinRule} className="mt-3">
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <Button type="submit" variant="ghost" size="sm">Delete</Button>
                    </form>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
