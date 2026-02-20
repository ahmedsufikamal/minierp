import { resolveCustomizationRuntime } from "@/modules/platform/application/customization.service";
import { customizationRuntimeQuerySchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationRead, async (ctx) => {
    const query = parseQuery(request, customizationRuntimeQuerySchema);
    return jsonOk(await resolveCustomizationRuntime(ctx, query));
  });
}
