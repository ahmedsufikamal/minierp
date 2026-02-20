"use client";

import PageHeader from "@/components/page-header";
import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function AccountingPeriodsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Fiscal Years & Periods"
        subtitle="Accounting period governance baseline with canonical API-backed management."
      />
      <ModuleWorkbenchPlaceholder
        moduleName="Fiscal Years & Periods"
        description="Manage fiscal windows and posting period controls for GL and voucher workflows."
        apiHref="/api/v1/accounting/periods"
      />
    </div>
  );
}
