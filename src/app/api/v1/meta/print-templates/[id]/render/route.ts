import { renderPublishedTemplate } from "@/modules/platform/application/meta-model.service";
import { metaRenderTemplateQuerySchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPlatformAuth(request, platformPermissions.metaRead, async (ctx) => {
    const { id } = await context.params;
    const query = parseQuery(request, metaRenderTemplateQuerySchema);
    return jsonOk(await renderPublishedTemplate(ctx, id, query));
  });
}
