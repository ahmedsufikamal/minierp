import { mergeMasterParty } from "@/modules/platform/application/master-party.service";
import { masterPartyMergeSchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPlatformAuth(request, platformPermissions.masterWrite, async (ctx) => {
    const { id } = await context.params;
    const payload = await parseJson(request, masterPartyMergeSchema);
    return jsonOk(await mergeMasterParty(ctx, id, payload), { status: 201 });
  });
}
