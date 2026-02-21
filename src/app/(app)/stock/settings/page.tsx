import PageHeader from "@/components/page-header";
import { getInventoryPageContextAuthenticated } from "@/modules/inventory/interface/page-context";
import { StockSettingsShellClient } from "./stock-settings-shell-client";

export const dynamic = "force-dynamic";

export default async function StockSettingsPage() {
  const ctx = await getInventoryPageContextAuthenticated();
  const level = ctx.userTypeLevel ?? 3;
  const canEdit = level >= 4;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Settings"
        subtitle="ERP-style stock controls with meta actions, comments, and activity timeline."
      />
      <StockSettingsShellClient canEdit={canEdit} />
    </div>
  );
}
