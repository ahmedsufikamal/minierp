import { getOperationalKpiSnapshot } from "@/modules/platform/application/ops-ai.service";
import { analyticsOpsQuerySchema } from "@/modules/platform/domain/ops-ai.schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.reportingRead, async (ctx) => {
    const query = parseQuery(request, analyticsOpsQuerySchema);
    return jsonOk(await getOperationalKpiSnapshot(ctx, query));
  });
}
