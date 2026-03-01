import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";
import { requireTradePermissionPage } from "@/modules/trade/interface/page-guards";
import { tradePermissions } from "@/modules/trade/domain/types";

export default async function Page() {
  await requireTradePermissionPage(tradePermissions.lcRead, "/trade/lc/discrepancies");
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="LC Discrepancies"
      description="Work unresolved discrepancy decisions and waivers."
      apiHref="/api/v1/trade/lc/discrepancies"
    />
  );
}
