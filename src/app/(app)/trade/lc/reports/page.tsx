import { requireTradePermissionPage } from "@/modules/trade/interface/page-guards";
import { tradePermissions } from "@/modules/trade/domain/types";
import { LCReportsClient } from "@/components/trade/lc/lc-reports-client";

export default async function Page() {
  await requireTradePermissionPage(tradePermissions.lcRead, "/trade/lc/reports");
  return <LCReportsClient />;
}
