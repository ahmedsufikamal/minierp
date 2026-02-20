import { createFormLayout } from "@/modules/platform/application/customization.service";
import { formLayoutSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, formLayoutSchema);
    return jsonOk(await createFormLayout(ctx, payload), { status: 201 });
  });
}
