import { createMasterParty, listMasterParties } from "@/modules/platform/application/master-party.service";
import { masterPartiesQuerySchema, masterPartyUpsertSchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.masterRead, async (ctx) => {
    const query = parseQuery(request, masterPartiesQuerySchema);
    return jsonOk(await listMasterParties(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.masterWrite, async (ctx) => {
    const payload = await parseJson(request, masterPartyUpsertSchema);
    return jsonOk(await createMasterParty(ctx, payload), { status: 201 });
  });
}
