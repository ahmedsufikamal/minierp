import PageHeader from "@/components/page-header";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContext } from "@/modules/inventory/interface/page-context";
import { StockClosingAdminClient } from "./stock-closing-admin-client";

export const dynamic = "force-dynamic";

export default async function StockClosingPage() {
  await getInventoryPageContext(inventoryPermissions.adminOps);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Closing"
        subtitle="Materialize stock quantity/value snapshots for faster period reporting."
      />
      <StockClosingAdminClient />
    </div>
  );
}

