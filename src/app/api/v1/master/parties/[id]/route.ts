import { updateMasterParty } from "@/modules/platform/application/master-party.service";
import { masterPartyUpsertSchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPlatformAuth(request, platformPermissions.masterWrite, async (ctx) => {
    const { id } = await context.params;
    const payload = await parseJson(request, masterPartyUpsertSchema.partial());
    return jsonOk(await updateMasterParty(ctx, id, payload));
  });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}
