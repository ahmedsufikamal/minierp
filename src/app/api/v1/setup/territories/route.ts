import { createSetupTerritory, listSetupTerritories } from "@/modules/platform/application/setup-masters.service";
import { setupMasterListQuerySchema, setupTerritorySchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationRead, async (ctx) => {
    const query = parseQuery(request, setupMasterListQuerySchema);
    return jsonOk(await listSetupTerritories(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, setupTerritorySchema);
    return jsonOk(await createSetupTerritory(ctx, payload), { status: 201 });
  });
}
