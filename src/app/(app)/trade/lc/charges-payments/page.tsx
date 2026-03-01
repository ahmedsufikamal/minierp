import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";
import { requireTradePermissionPage } from "@/modules/trade/interface/page-guards";
import { tradePermissions } from "@/modules/trade/domain/types";

export default async function Page() {
  await requireTradePermissionPage(tradePermissions.lcRead, "/trade/lc/charges-payments");
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="LC Charges & Payments"
      description="Monitor bank charges, margins, settlements, and payment posting queues."
      apiHref="/api/v1/trade/lc/payments"
    />
  );
}
