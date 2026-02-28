import { allocateMasterSeriesNumber } from "@/modules/platform/application/master-number-series.service";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request, context: { params: Promise<{ key: string }> }) {
  return withPlatformAuth(request, platformPermissions.masterWrite, async (ctx) => {
    const { key } = await context.params;
    const body = await request.json().catch(() => ({}));
    return jsonOk(await allocateMasterSeriesNumber(ctx, key, body), { status: 201 });
  });
}
