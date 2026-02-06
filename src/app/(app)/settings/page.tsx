import Link from "next/link";
import PageHeader from "@/components/page-header";
import { getOrgIdOrUserId } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const orgId = await getOrgIdOrUserId();
  const settings = await getOrgSettings(orgId);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Organization and number sequences." />

      <SettingsForm
        defaults={{
          orgName: settings.orgName ?? "",
          invoicePrefix: settings.invoicePrefix ?? "INV-",
          invoiceNext: settings.invoiceNext ?? "1",
          billPrefix: settings.billPrefix ?? "BILL-",
          billNext: settings.billNext ?? "1",
          quotePrefix: settings.quotePrefix ?? "QUOTE-",
          quoteNext: settings.quoteNext ?? "1",
          poPrefix: settings.poPrefix ?? "PO-",
          poNext: settings.poNext ?? "1",
          defaultCurrency: settings.defaultCurrency ?? "BDT",
          taxRate: settings.taxRate ?? "",
        }}
      />

      <div className="rounded-xl border p-4">
        <h2 className="font-medium text-slate-900 mb-2">Audit log</h2>
        <p className="text-sm text-slate-600 mb-3">
          View a history of changes to key entities in your organization.
        </p>
        <Link
          href="/settings/audit-log"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          Open audit log →
        </Link>
      </div>
    </div>
  );
}
