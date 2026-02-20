import { createSetupItemGroup, listSetupItemGroups } from "@/modules/platform/application/setup-masters.service";
import { setupItemGroupSchema, setupMasterListQuerySchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationRead, async (ctx) => {
    const query = parseQuery(request, setupMasterListQuerySchema);
    return jsonOk(await listSetupItemGroups(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, setupItemGroupSchema);
    return jsonOk(await createSetupItemGroup(ctx, payload), { status: 201 });
  });
}
