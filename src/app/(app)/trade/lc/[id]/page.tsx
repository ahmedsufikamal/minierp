import { requireTradePermissionPage } from "@/modules/trade/interface/page-guards";
import { tradePermissions } from "@/modules/trade/domain/types";
import { LCRecordClient } from "@/components/trade/lc/lc-record-client";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireTradePermissionPage(tradePermissions.lcRead, "/trade/lc");
  const { id } = await params;
  return <LCRecordClient lcId={id} />;
}
