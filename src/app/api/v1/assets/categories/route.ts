import { createAssetCategory, listAssetCategories } from "@/modules/assets/application/categories.service";
import { assetCategoryCreateSchema, assetCategoryListQuerySchema } from "@/modules/assets/domain/schemas";
import { assetsPermissions } from "@/modules/assets/domain/types";
import { jsonOk, parseJson, parseQuery, withAssetsAuth } from "@/modules/assets/interface/http";

export async function GET(request: Request) {
  return withAssetsAuth(request, assetsPermissions.categoryRead, async (ctx) => {
    const query = parseQuery(request, assetCategoryListQuerySchema);
    return jsonOk(await listAssetCategories(ctx, query));
  });
}

export async function POST(request: Request) {
  return withAssetsAuth(request, assetsPermissions.categoryWrite, async (ctx) => {
    const payload = await parseJson(request, assetCategoryCreateSchema);
    return jsonOk(await createAssetCategory(ctx, payload), { status: 201 });
  });
}
