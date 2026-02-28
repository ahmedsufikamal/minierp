import { createMasterItem, listMasterItems } from "@/modules/platform/application/master-item.service";
import { masterItemUpsertSchema, masterItemsQuerySchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.masterRead, async (ctx) => {
    const query = parseQuery(request, masterItemsQuerySchema);
    return jsonOk(await listMasterItems(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.masterWrite, async (ctx) => {
    const payload = await parseJson(request, masterItemUpsertSchema);
    return jsonOk(await createMasterItem(ctx, payload), { status: 201 });
  });
}
