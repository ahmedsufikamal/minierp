import PageHeader from "@/components/page-header";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContext } from "@/modules/inventory/interface/page-context";
import { StockWorkspaceClient, WorkspaceHeaderActions } from "./_components/workspace-client";

export const dynamic = "force-dynamic";

export default async function StockWorkspacePage() {
  await getInventoryPageContext(inventoryPermissions.itemRead);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock"
        subtitle="Workspace view for stock value, warehouse movement insight, and master/report shortcuts."
        actions={<WorkspaceHeaderActions />}
      />
      <StockWorkspaceClient />
    </div>
  );
}
