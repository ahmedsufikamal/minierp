import { prisma } from "@/lib/prisma";
import { requirePermissionPage } from "@/modules/iam";
import {
  deleteAutoJoinRuleAction,
  generateDomainVerificationTokenAction,
  saveOrgSettingsAction,
  upsertAutoJoinRuleAction,
  verifyDomainAction,
} from "@/app/(app)/org/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

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
  const mfaMode = normalizeMfaMode(String((company?.mfaPolicy as { mode?: string } | null)?.mode ?? "OPTIONAL"));
  const turnstileEnabled = Boolean((company?.botProtectionPolicy as { turnstileEnabled?: boolean } | null)?.turnstileEnabled ?? false);
  const submitSettings = async (formData: FormData) => {
    "use server";
    await saveOrgSettingsAction(formData);
  };
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
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization settings</h1>
        <p className="text-sm text-muted-foreground">Branding, domains, and authentication policies.</p>
      </div>

      <section className="rounded-lg border p-4">
        <h2 className="font-medium">Company Numbering</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage SKU and document code formats for this company.
        </p>
        <Link href="/org/settings/company-numbering" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          Open company numbering →
        </Link>
      </section>

      <form action={submitSettings} className="space-y-6 rounded-lg border p-4">
        <section className="space-y-3">
          <h2 className="font-medium">Branding</h2>
          <Input name="logoUrl" placeholder="Logo URL" defaultValue={company?.logoUrl ?? ""} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input name="primaryColor" placeholder="Primary color (#112233)" defaultValue={company?.primaryColor ?? ""} />
            <Input name="accentColor" placeholder="Accent color (#334455)" defaultValue={company?.accentColor ?? ""} />
            <Input name="fontFamily" placeholder="Font family" defaultValue={company?.fontFamily ?? ""} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Domains</h2>
          <Input name="primaryDomain" placeholder="app.customer.com" defaultValue={company?.primaryDomain ?? ""} />
          <Input
            name="allowedDomains"
            placeholder="customer.com, auth.customer.com"
            defaultValue={Array.isArray(company?.allowedDomains) ? company?.allowedDomains.join(", ") : ""}
          />
          <p className="text-xs text-muted-foreground">
            Verification status: {company?.domainVerificationStatus ?? "PENDING"}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Allowed auth methods</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label><input type="checkbox" name="auth_password" defaultChecked={authMethods.includes("PASSWORD")} /> Password</label>
            <label><input type="checkbox" name="auth_magic_link" defaultChecked={authMethods.includes("MAGIC_LINK")} /> Magic link</label>
            <label><input type="checkbox" name="auth_google" defaultChecked={authMethods.includes("OAUTH_GOOGLE")} /> Google OAuth</label>
            <label><input type="checkbox" name="auth_microsoft" defaultChecked={authMethods.includes("OAUTH_MICROSOFT")} /> Microsoft OAuth</label>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">MFA policy</h2>
          <select name="mfaMode" defaultValue={mfaMode} className="h-9 rounded-md border border-border bg-transparent px-3">
            <option value="OPTIONAL">Optional</option>
            <option value="REQUIRED_FOR_ADMINS">Required for owners/admins</option>
            <option value="REQUIRED_FOR_ALL">Required for all users</option>
          </select>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Bot protection</h2>
          <label className="text-sm"><input type="checkbox" name="turnstileEnabled" defaultChecked={turnstileEnabled} /> Enable Turnstile on auth flows</label>
        </section>

        <Button type="submit">Save settings</Button>
      </form>

      <section className="space-y-4 rounded-lg border p-4">
        <h2 className="font-medium">Domain verification</h2>
        <p className="text-xs text-muted-foreground">
          Generate a verification token, add it as a TXT value, then verify ownership.
        </p>
        <form action={submitGenerateDomainToken}>
          <Button type="submit" variant="outline">Generate verification token</Button>
        </form>
        {company?.domainVerificationToken ? (
          <div className="space-y-2 rounded border p-3 text-xs">
            <p>
              TXT host: <span className="font-mono">_minierp-verify.{company.primaryDomain ?? "your-domain.com"}</span>
            </p>
            <p>
              TXT value: <span className="font-mono break-all">{company.domainVerificationToken}</span>
            </p>
            {company.domainVerificationGeneratedAt ? (
              <p className="text-muted-foreground">
                Generated at: {new Date(company.domainVerificationGeneratedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : null}
        <form action={submitVerifyDomain} className="flex flex-wrap items-center gap-2">
          <Input name="domainVerificationToken" placeholder="Paste verification token" />
          <Button type="submit" variant="outline">Verify domain</Button>
        </form>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <h2 className="font-medium">Auto-join rules</h2>
        <form action={submitUpsertAutoJoinRule} className="space-y-3">
          <select name="ruleType" className="h-9 rounded-md border border-border bg-transparent px-3">
            <option value="VERIFIED_DOMAIN">Verified domain</option>
            <option value="EMAIL_ALLOWLIST">Email allowlist</option>
            <option value="MANUAL_APPROVAL">Manual approval</option>
          </select>
          <Input name="domains" placeholder="Domains (comma-separated), e.g. acme.com, sub.acme.com" />
          <Input name="allowlist" placeholder="Allowlist emails (comma-separated)" />
          <label className="text-sm">
            <input type="checkbox" name="requireAdminApproval" /> Require admin approval
          </label>
          <label className="text-sm">
            <input type="checkbox" name="isEnabled" defaultChecked /> Enabled
          </label>
          <Button type="submit" variant="outline">Add rule</Button>
        </form>

        <div className="space-y-2">
          {autoJoinRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No auto-join rules configured.</p>
          ) : (
            autoJoinRules.map((rule) => {
              const config = (rule.config as { domains?: string[]; allowlist?: string[]; requireAdminApproval?: boolean } | null) ?? {};
              return (
                <div key={rule.id} className="rounded border p-3 text-sm">
                  <p className="mb-2 font-medium">Rule: {rule.ruleType}</p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Updated: {new Date(rule.updatedAt).toLocaleString()}
                  </p>
                  <form action={submitUpsertAutoJoinRule} className="space-y-2">
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <select name="ruleType" defaultValue={rule.ruleType} className="h-9 rounded-md border border-border bg-transparent px-3">
                      <option value="VERIFIED_DOMAIN">Verified domain</option>
                      <option value="EMAIL_ALLOWLIST">Email allowlist</option>
                      <option value="MANUAL_APPROVAL">Manual approval</option>
                    </select>
                    <Input name="domains" defaultValue={config.domains?.join(", ") ?? ""} placeholder="Domains (comma-separated)" />
                    <Input name="allowlist" defaultValue={config.allowlist?.join(", ") ?? ""} placeholder="Allowlist emails (comma-separated)" />
                    <label className="block text-xs text-muted-foreground">
                      <input type="checkbox" name="requireAdminApproval" defaultChecked={Boolean(config.requireAdminApproval)} /> Require admin approval
                    </label>
                    <label className="block text-xs text-muted-foreground">
                      <input type="checkbox" name="isEnabled" defaultChecked={rule.isEnabled} /> Enabled
                    </label>
                    <Button type="submit" variant="outline" size="sm">Save rule</Button>
                  </form>
                  <form action={submitDeleteAutoJoinRule} className="mt-2">
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <Button type="submit" variant="outline" size="sm">Delete</Button>
                  </form>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
