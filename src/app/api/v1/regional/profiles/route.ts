import { createRegionalProfile, listRegionalProfiles } from "@/modules/regional/application/profiles.service";
import { regionalProfileCreateSchema, regionalProfileListQuerySchema } from "@/modules/regional/domain/schemas";
import { regionalPermissions } from "@/modules/regional/domain/types";
import { jsonOk, parseJson, parseQuery, withRegionalAuth } from "@/modules/regional/interface/http";

export async function GET(request: Request) {
  return withRegionalAuth(request, regionalPermissions.profileRead, async (ctx) => {
    const query = parseQuery(request, regionalProfileListQuerySchema);
    return jsonOk(await listRegionalProfiles(ctx, query));
  });
}

export async function POST(request: Request) {
  return withRegionalAuth(request, regionalPermissions.profileWrite, async (ctx) => {
    const payload = await parseJson(request, regionalProfileCreateSchema);
    return jsonOk(await createRegionalProfile(ctx, payload), { status: 201 });
  });
}
