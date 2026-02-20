import { createSetupSupplierGroup, listSetupSupplierGroups } from "@/modules/platform/application/setup-masters.service";
import { setupMasterListQuerySchema, setupSupplierGroupSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationRead, async (ctx) => {
    const query = parseQuery(request, setupMasterListQuerySchema);
    return jsonOk(await listSetupSupplierGroups(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, setupSupplierGroupSchema);
    return jsonOk(await createSetupSupplierGroup(ctx, payload), { status: 201 });
  });
}
