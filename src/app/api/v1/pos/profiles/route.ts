import { createPosProfile, listPosProfiles } from "@/modules/pos/application/profiles.service";
import { posProfileCreateSchema, posProfileListQuerySchema } from "@/modules/pos/domain/schemas";
import { posPermissions } from "@/modules/pos/domain/types";
import { jsonOk, parseJson, parseQuery, withPosAuth } from "@/modules/pos/interface/http";

export async function GET(request: Request) {
  return withPosAuth(request, posPermissions.profileRead, async (ctx) => {
    const query = parseQuery(request, posProfileListQuerySchema);
    return jsonOk(await listPosProfiles(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPosAuth(request, posPermissions.profileWrite, async (ctx) => {
    const payload = await parseJson(request, posProfileCreateSchema);
    return jsonOk(await createPosProfile(ctx, payload), { status: 201 });
  });
}
