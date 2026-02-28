import Link from "next/link";
import PageHeader from "@/components/page-header";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const companyId = await getCompanyIdOrUserId();
  const settings = await getOrgSettings(companyId);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Organization and number sequences." />

      <SettingsForm
        defaults={{
          orgName: settings.orgName ?? "",
          defaultCurrency: settings.defaultCurrency ?? "BDT",
          taxRate: settings.taxRate ?? "",
        }}
      />

      <div className="rounded-xl border p-4">
        <h2 className="font-medium text-foreground mb-2">Audit log</h2>
        <p className="text-sm text-muted-foreground mb-3">
          View a history of changes to key entities in your organization.
        </p>
        <Link
          href="/settings/audit-log"
          className="text-sm font-medium text-foreground hover:underline"
        >
          Open audit log →
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h2 className="font-medium text-foreground mb-2">Account security</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Manage your profile, active sessions, and MFA settings.
          </p>
          <Link href="/settings/user" className="text-sm font-medium text-foreground hover:underline">
            Open account settings →
          </Link>
        </div>
        <div className="rounded-xl border p-4">
          <h2 className="font-medium text-foreground mb-2">Organization IAM</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Configure tenant branding, members, roles, and auth policies.
          </p>
          <Link href="/org/settings" className="text-sm font-medium text-foreground hover:underline">
            Open organization IAM →
          </Link>
        </div>
      </div>
    </div>
  );
}
