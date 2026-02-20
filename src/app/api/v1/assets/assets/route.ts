import { createAsset, listAssets } from "@/modules/assets/application/assets.service";
import { assetCreateSchema, assetListQuerySchema } from "@/modules/assets/domain/schemas";
import { assetsPermissions } from "@/modules/assets/domain/types";
import { jsonOk, parseJson, parseQuery, withAssetsAuth } from "@/modules/assets/interface/http";

export async function GET(request: Request) {
  return withAssetsAuth(request, assetsPermissions.assetRead, async (ctx) => {
    const query = parseQuery(request, assetListQuerySchema);
    return jsonOk(await listAssets(ctx, query));
  });
}

export async function POST(request: Request) {
  return withAssetsAuth(request, assetsPermissions.assetWrite, async (ctx) => {
    const payload = await parseJson(request, assetCreateSchema);
    return jsonOk(await createAsset(ctx, payload), { status: 201 });
  });
}
