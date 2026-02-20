import { applyAssetAction } from "@/modules/assets/application/assets.service";
import { assetActionSchema } from "@/modules/assets/domain/schemas";
import { assetsPermissions } from "@/modules/assets/domain/types";
import { jsonOk, parseJson, withAssetsAuth } from "@/modules/assets/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  return withAssetsAuth(request, assetsPermissions.assetPost, async (ctx) => {
    const { assetId } = await context.params;
    const payload = await parseJson(request, assetActionSchema);
    return jsonOk(await applyAssetAction(ctx, assetId, payload));
  });
}
