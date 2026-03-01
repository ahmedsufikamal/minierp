import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";
import { requireTradePermissionPage } from "@/modules/trade/interface/page-guards";
import { tradePermissions } from "@/modules/trade/domain/types";

export default async function Page() {
  await requireTradePermissionPage(tradePermissions.lcRead, "/trade/lc/amendments");
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="LC Amendments"
      description="Review and manage recent LC amendments across the workspace."
      apiHref="/api/v1/trade/lc/amendments"
    />
  );
}
