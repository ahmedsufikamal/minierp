import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/iam";
import { saveOrgSettingsAction } from "@/app/(app)/org/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function OrgSettingsPage() {
  await requirePermission("admin.settings");
  const principal = await requirePermission("admin.settings");

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
      allowedAuthMethods: true,
      mfaPolicy: true,
      botProtectionPolicy: true,
    },
  });

  const authMethods = (company?.allowedAuthMethods as string[] | null) ?? [];
  const mfaMode = String((company?.mfaPolicy as { mode?: string } | null)?.mode ?? "OPTIONAL");
  const turnstileEnabled = Boolean((company?.botProtectionPolicy as { turnstileEnabled?: boolean } | null)?.turnstileEnabled ?? false);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization settings</h1>
        <p className="text-sm text-muted-foreground">Branding, domains, and authentication policies.</p>
      </div>

      <form action={saveOrgSettingsAction} className="space-y-6 rounded-lg border p-4">
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
          <select name="mfaMode" className="h-9 rounded-md border border-border bg-transparent px-3">
            <option value="OPTIONAL" selected={mfaMode === "OPTIONAL"}>Optional</option>
            <option value="REQUIRED_FOR_ADMINS" selected={mfaMode === "REQUIRED_FOR_ADMINS"}>Required for owners/admins</option>
            <option value="REQUIRED_FOR_ALL" selected={mfaMode === "REQUIRED_FOR_ALL"}>Required for all users</option>
          </select>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Bot protection</h2>
          <label className="text-sm"><input type="checkbox" name="turnstileEnabled" defaultChecked={turnstileEnabled} /> Enable Turnstile on auth flows</label>
        </section>

        <Button type="submit">Save settings</Button>
      </form>
    </div>
  );
}
