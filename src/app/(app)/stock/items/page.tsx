import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContext } from "@/modules/inventory/interface/page-context";
import { StockItemsListClient } from "./items-list-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StockItemsPage() {
  await getInventoryPageContext(inventoryPermissions.itemRead);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Items"
        subtitle="ERP list view with filters, actions, and server-side pagination."
        actions={
          <Button asChild size="sm">
            <Link href="/stock/items/new">+ Add Item</Link>
          </Button>
        }
      />
      <StockItemsListClient />
    </div>
  );
}
