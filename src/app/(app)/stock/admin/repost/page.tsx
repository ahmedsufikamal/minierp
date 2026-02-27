import PageHeader from "@/components/page-header";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContext } from "@/modules/inventory/interface/page-context";
import { RepostAdminClient } from "./repost-admin-client";

export const dynamic = "force-dynamic";

export default async function StockRepostPage() {
  await getInventoryPageContext(inventoryPermissions.adminOps);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Repost / Rebuild"
        subtitle="Rebuild derived balances and FIFO layers from immutable ledger."
      />
      <RepostAdminClient />
    </div>
  );
}

