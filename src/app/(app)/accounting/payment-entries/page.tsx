"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/page-header";
import { SubNavTabs } from "@/components/ui/SubNavTabs";
import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

const tabs = [
  { id: "payment-entries", label: "Payment Entries" },
  { id: "exchange-rates", label: "Exchange Rates" },
  { id: "cost-centers", label: "Cost Centers" },
  { id: "dimensions", label: "Dimensions" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function apiPathFor(tab: TabId): string {
  if (tab === "payment-entries") return "/api/v1/accounting/payment-entries";
  if (tab === "exchange-rates") return "/api/v1/accounting/exchange-rates";
  if (tab === "cost-centers") return "/api/v1/accounting/cost-centers";
  return "/api/v1/accounting/dimensions";
}

function descriptionFor(tab: TabId): string {
  if (tab === "payment-entries") {
    return "Allocation-aware payment entries with submit/post/cancel actions and posting controls.";
  }
  if (tab === "exchange-rates") {
    return "Multi-currency rate table for conversion and payment posting.";
  }
  if (tab === "cost-centers") {
    return "Cost center hierarchy used for posting dimensions and analytics.";
  }
  return "Accounting dimensions for tagged posting policies and reporting scopes.";
}

export default function AccountingPaymentEntriesPage() {
  const [tab, setTab] = useState<TabId>("payment-entries");

  const title = useMemo(() => {
    const active = tabs.find((entry) => entry.id === tab);
    return active?.label ?? "Payment Entries";
  }, [tab]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounting Financial Controls"
        subtitle="Payment Entry, multi-currency, and dimension master-data baseline for parity closure."
      />

      <SubNavTabs tabs={tabs.map((entry) => ({ id: entry.id, label: entry.label }))} value={tab} onChange={(value) => setTab(value as TabId)} />

      <ModuleWorkbenchPlaceholder
        moduleName={title}
        description={descriptionFor(tab)}
        apiHref={apiPathFor(tab)}
      />
    </div>
  );
}
