import { createFormLayout, listFormLayouts } from "@/modules/platform/application/customization.service";
import { formLayoutListQuerySchema, formLayoutSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationRead, async (ctx) => {
    const query = parseQuery(request, formLayoutListQuerySchema);
    return jsonOk(await listFormLayouts(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, formLayoutSchema);
    return jsonOk(await createFormLayout(ctx, payload), { status: 201 });
  });
}
