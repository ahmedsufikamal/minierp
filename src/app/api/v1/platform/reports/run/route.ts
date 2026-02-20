import { runReport } from "@/modules/platform/application/reporting.service";
import { reportRunSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.reportingRead, async (ctx) => {
    const payload = await parseJson(request, reportRunSchema);
    return jsonOk(await runReport(ctx, payload));
  });
}
