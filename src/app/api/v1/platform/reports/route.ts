import { listReportDefinitions, upsertReportDefinition } from "@/modules/platform/application/reporting.service";
import { reportDefinitionSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.reportingRead, async (ctx) => {
    return jsonOk(await listReportDefinitions(ctx));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.reportingWrite, async (ctx) => {
    const payload = await parseJson(request, reportDefinitionSchema);
    return jsonOk(await upsertReportDefinition(ctx, payload), { status: 201 });
  });
}
