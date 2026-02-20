import { upsertReportView } from "@/modules/platform/application/reporting.service";
import { reportViewSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.reportingWrite, async (ctx) => {
    const payload = await parseJson(request, reportViewSchema);
    return jsonOk(await upsertReportView(ctx, payload), { status: 201 });
  });
}
