import { requireTradePermissionPage } from "@/modules/trade/interface/page-guards";
import { tradePermissions } from "@/modules/trade/domain/types";
import { LCDashboardClient } from "@/components/trade/lc/lc-dashboard-client";

export default async function Page() {
  await requireTradePermissionPage(tradePermissions.lcRead, "/trade/lc");
  return <LCDashboardClient />;
}
