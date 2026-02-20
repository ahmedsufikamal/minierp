import { createSetupUom, listSetupUoms } from "@/modules/platform/application/setup-masters.service";
import { setupMasterListQuerySchema, setupUomSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationRead, async (ctx) => {
    const query = parseQuery(request, setupMasterListQuerySchema);
    return jsonOk(await listSetupUoms(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, setupUomSchema);
    return jsonOk(await createSetupUom(ctx, payload), { status: 201 });
  });
}
