import { requireTradePermissionPage } from "@/modules/trade/interface/page-guards";
import { tradePermissions } from "@/modules/trade/domain/types";
import { LCSettingsClient } from "@/components/trade/lc/lc-settings-client";

export default async function Page() {
  await requireTradePermissionPage(tradePermissions.lcAdmin, "/trade/lc/settings");
  return <LCSettingsClient />;
}
