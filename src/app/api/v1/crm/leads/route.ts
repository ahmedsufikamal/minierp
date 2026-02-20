import { createLead, listLeads } from "@/modules/crm/application/leads.service";
import { leadCreateSchema, leadListQuerySchema } from "@/modules/crm/domain/schemas";
import { crmPermissions } from "@/modules/crm/domain/types";
import { jsonOk, parseJson, parseQuery, withCrmAuth } from "@/modules/crm/interface/http";

export async function GET(request: Request) {
  return withCrmAuth(request, crmPermissions.leadRead, async (ctx) => {
    const query = parseQuery(request, leadListQuerySchema);
    return jsonOk(await listLeads(ctx, query));
  });
}

export async function POST(request: Request) {
  return withCrmAuth(request, crmPermissions.leadWrite, async (ctx) => {
    const payload = await parseJson(request, leadCreateSchema);
    return jsonOk(await createLead(ctx, payload), { status: 201 });
  });
}
