import { requireTradePermissionPage } from "@/modules/trade/interface/page-guards";
import { tradePermissions } from "@/modules/trade/domain/types";
import { LCNewClient } from "@/components/trade/lc/lc-new-client";

export default async function Page() {
  await requireTradePermissionPage(tradePermissions.lcWrite, "/trade/lc/new");
  return <LCNewClient />;
}
