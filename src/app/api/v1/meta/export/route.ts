import { exportMetaBundle } from "@/modules/platform/application/meta-model.service";
import { metaExportQuerySchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.metaRead, async (ctx) => {
    const query = parseQuery(request, metaExportQuerySchema);
    return jsonOk(await exportMetaBundle(ctx, query));
  });
}
