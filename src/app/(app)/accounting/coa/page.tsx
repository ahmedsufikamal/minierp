"use client";

import PageHeader from "@/components/page-header";
import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function ChartOfAccountsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Chart of Accounts"
        subtitle="API-first account hierarchy baseline for ledger posting and classification."
      />
      <ModuleWorkbenchPlaceholder
        moduleName="Chart of Accounts"
        description="Manage account masters and posting/non-posting account behavior."
        apiHref="/api/v1/accounting/accounts"
      />
    </div>
  );
}
