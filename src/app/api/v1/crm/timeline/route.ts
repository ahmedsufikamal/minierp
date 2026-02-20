import { getCrmTimeline } from "@/modules/crm/application/timeline.service";
import { timelineQuerySchema } from "@/modules/crm/domain/schemas";
import { crmPermissions } from "@/modules/crm/domain/types";
import { jsonOk, parseQuery, withCrmAuth } from "@/modules/crm/interface/http";

export async function GET(request: Request) {
  return withCrmAuth(request, crmPermissions.timelineRead, async (ctx) => {
    const query = parseQuery(request, timelineQuerySchema);
    return jsonOk(await getCrmTimeline(ctx, query));
  });
}
