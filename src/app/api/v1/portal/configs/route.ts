import {
  createPortalConfig,
  listPortalConfigs,
} from "@/modules/portal/application/configs.service";
import {
  portalConfigCreateSchema,
  portalConfigListQuerySchema,
} from "@/modules/portal/domain/schemas";
import { portalPermissions } from "@/modules/portal/domain/types";
import { jsonOk, parseJson, parseQuery, withPortalAuth } from "@/modules/portal/interface/http";

export async function GET(request: Request) {
  return withPortalAuth(request, portalPermissions.configRead, async (ctx) => {
    const query = parseQuery(request, portalConfigListQuerySchema);
    return jsonOk(await listPortalConfigs(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPortalAuth(request, portalPermissions.configWrite, async (ctx) => {
    const payload = await parseJson(request, portalConfigCreateSchema);
    return jsonOk(await createPortalConfig(ctx, payload), { status: 201 });
  });
}
