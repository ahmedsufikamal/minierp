"use client";

import PageHeader from "@/components/page-header";
import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

export default function JournalEntriesPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Journal Entries"
        subtitle="API-first journal workbench with create, review, and workflow actions."
      />
      <ModuleWorkbenchPlaceholder
        moduleName="Journal Entries"
        description="Create and transition journal vouchers through accounting workflow actions."
        apiHref="/api/v1/accounting/journal-entries"
      />
    </div>
  );
}
