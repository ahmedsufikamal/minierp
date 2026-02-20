import { upsertReportSchedule } from "@/modules/platform/application/reporting.service";
import { reportScheduleSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.reportingWrite, async (ctx) => {
    const payload = await parseJson(request, reportScheduleSchema);
    return jsonOk(await upsertReportSchedule(ctx, payload), { status: 201 });
  });
}
