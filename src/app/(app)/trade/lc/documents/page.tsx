import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";
import { requireTradePermissionPage } from "@/modules/trade/interface/page-guards";
import { tradePermissions } from "@/modules/trade/domain/types";

export default async function Page() {
  await requireTradePermissionPage(tradePermissions.lcRead, "/trade/lc/documents");
  return (
    <ModuleWorkbenchPlaceholder
      moduleName="LC Documents & Checklist"
      description="Track document-set receipt, verification, and scrutiny queues."
      apiHref="/api/v1/trade/lc/docsets"
    />
  );
}
