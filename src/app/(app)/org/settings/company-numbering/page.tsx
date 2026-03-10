import Link from "next/link";
import { requirePermissionPage } from "@/modules/iam";
import { MASTER_ADMIN_ROLE_NAME } from "@/modules/iam/application/master-admin";
import { CompanyNumberingClient } from "./company-numbering-client";

export const dynamic = "force-dynamic";

export default async function CompanyNumberingPage() {
  const principal = await requirePermissionPage("admin.settings", "/org/settings/company-numbering");
  const isOwner = principal.membershipRole === MASTER_ADMIN_ROLE_NAME;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Company Code Format Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure YGEN company document code formats from a single tenant-aware admin workspace. Rich settings are saved server-side and projected back into the current numbering compatibility layer.
        </p>
        <Link href="/org/settings" className="text-sm font-medium text-primary hover:underline">
          Back to organization settings
        </Link>
      </div>

      <CompanyNumberingClient canManage={isOwner} />
    </div>
  );
}
