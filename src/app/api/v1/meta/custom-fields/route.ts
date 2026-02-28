import { upsertMetaCustomField } from "@/modules/platform/application/meta-model.service";
import { metaCustomFieldUpsertSchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.metaWrite, async (ctx) => {
    const payload = await parseJson(request, metaCustomFieldUpsertSchema);
    return jsonOk(await upsertMetaCustomField(ctx, payload), { status: 201 });
  });
}
