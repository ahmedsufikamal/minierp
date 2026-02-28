import { getMetaModel, updateMetaModel } from "@/modules/platform/application/meta-model.service";
import { metaModelUpdateSchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  return withPlatformAuth(request, platformPermissions.metaRead, async (ctx) => {
    const { name } = await context.params;
    return jsonOk(await getMetaModel(ctx, name));
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ name: string }> }) {
  return withPlatformAuth(request, platformPermissions.metaWrite, async (ctx) => {
    const { name } = await context.params;
    const payload = await parseJson(request, metaModelUpdateSchema);
    return jsonOk(await updateMetaModel(ctx, name, payload));
  });
}

export async function PUT(request: Request, context: { params: Promise<{ name: string }> }) {
  return PATCH(request, context);
}
