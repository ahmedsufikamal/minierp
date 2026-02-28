import { listMasterPriceLists, upsertMasterPriceList } from "@/modules/platform/application/master-reference.service";
import { masterPriceListUpsertSchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.masterRead, async (ctx) => {
    return jsonOk(await listMasterPriceLists(ctx));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.masterWrite, async (ctx) => {
    const payload = await parseJson(request, masterPriceListUpsertSchema);
    return jsonOk(await upsertMasterPriceList(ctx, payload), { status: 201 });
  });
}
