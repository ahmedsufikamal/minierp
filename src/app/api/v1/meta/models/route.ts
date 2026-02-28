import { createMetaModel, listMetaModels } from "@/modules/platform/application/meta-model.service";
import {
  metaModelCreateSchema,
  pagingSchema,
} from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.metaRead, async (ctx) => {
    const query = parseQuery(request, pagingSchema);
    return jsonOk(await listMetaModels(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.metaWrite, async (ctx) => {
    const payload = await parseJson(request, metaModelCreateSchema);
    return jsonOk(await createMetaModel(ctx, payload), { status: 201 });
  });
}
