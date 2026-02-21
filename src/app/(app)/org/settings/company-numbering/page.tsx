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
        <h1 className="text-2xl font-semibold">Company Numbering</h1>
        <p className="text-sm text-muted-foreground">
          Configure SKU and company document code formats. Numbering is company-scoped and generated server-side.
        </p>
        <Link href="/org/settings" className="text-sm font-medium text-primary hover:underline">
          Back to organization settings
        </Link>
      </div>

      <CompanyNumberingClient canManage={isOwner} />
    </div>
  );
}
