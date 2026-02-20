import { createOpportunity, listOpportunities } from "@/modules/crm/application/opportunities.service";
import { opportunityCreateSchema, opportunityListQuerySchema } from "@/modules/crm/domain/schemas";
import { crmPermissions } from "@/modules/crm/domain/types";
import { jsonOk, parseJson, parseQuery, withCrmAuth } from "@/modules/crm/interface/http";

export async function GET(request: Request) {
  return withCrmAuth(request, crmPermissions.opportunityRead, async (ctx) => {
    const query = parseQuery(request, opportunityListQuerySchema);
    return jsonOk(await listOpportunities(ctx, query));
  });
}

export async function POST(request: Request) {
  return withCrmAuth(request, crmPermissions.opportunityWrite, async (ctx) => {
    const payload = await parseJson(request, opportunityCreateSchema);
    return jsonOk(await createOpportunity(ctx, payload), { status: 201 });
  });
}
