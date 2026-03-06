import { listActionRecommendations } from "@/modules/platform/application/ops-ai.service";
import { opsRecommendationsQuerySchema } from "@/modules/platform/domain/ops-ai.schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.reportingRead, async (ctx) => {
    const query = parseQuery(request, opsRecommendationsQuerySchema);
    return jsonOk(await listActionRecommendations(ctx, query));
  });
}
