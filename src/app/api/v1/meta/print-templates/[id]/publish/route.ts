import { publishPrintTemplate } from "@/modules/platform/application/meta-model.service";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPlatformAuth(request, platformPermissions.metaPublish, async (ctx) => {
    const { id } = await context.params;
    return jsonOk(await publishPrintTemplate(ctx, id));
  });
}
