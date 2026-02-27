import PageHeader from "@/components/page-header";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContext } from "@/modules/inventory/interface/page-context";
import { VarianceReportClient } from "./variance-report-client";

export const dynamic = "force-dynamic";

export default async function StockVarianceReportPage() {
  await getInventoryPageContext(inventoryPermissions.adminOps);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Variance Report"
        subtitle="Compare stock balances against immutable ledger (and FIFO layers when enabled)."
      />
      <VarianceReportClient />
    </div>
  );
}

