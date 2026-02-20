import { applyRegionalProfileAction } from "@/modules/regional/application/profiles.service";
import { regionalProfileActionSchema } from "@/modules/regional/domain/schemas";
import { regionalPermissions } from "@/modules/regional/domain/types";
import { jsonOk, parseJson, withRegionalAuth } from "@/modules/regional/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  return withRegionalAuth(request, regionalPermissions.profileManage, async (ctx) => {
    const { profileId } = await context.params;
    const payload = await parseJson(request, regionalProfileActionSchema);
    return jsonOk(await applyRegionalProfileAction(ctx, profileId, payload));
  });
}
