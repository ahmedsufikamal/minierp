import { listCustomizationMetadata } from "@/modules/platform/application/customization.service";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationRead, async (ctx) => {
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType") ?? undefined;
    return jsonOk(await listCustomizationMetadata(ctx, { entityType }));
  });
}
