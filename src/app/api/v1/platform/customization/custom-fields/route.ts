import { upsertCustomField } from "@/modules/platform/application/customization.service";
import { customFieldSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, customFieldSchema);
    return jsonOk(await upsertCustomField(ctx, payload), { status: 201 });
  });
}
