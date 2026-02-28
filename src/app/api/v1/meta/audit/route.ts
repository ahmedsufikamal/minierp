import { listMetaAudit } from "@/modules/platform/application/meta-model.service";
import { metaAuditQuerySchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.metaRead, async (ctx) => {
    const query = parseQuery(request, metaAuditQuerySchema);
    return jsonOk(await listMetaAudit(ctx, query));
  });
}
