import { createSlaPolicy, listSlaPolicies } from "@/modules/support/application/sla-policies.service";
import { slaPolicyCreateSchema, slaPolicyListQuerySchema } from "@/modules/support/domain/schemas";
import { supportPermissions } from "@/modules/support/domain/types";
import { jsonOk, parseJson, parseQuery, withSupportAuth } from "@/modules/support/interface/http";

export async function GET(request: Request) {
  return withSupportAuth(request, supportPermissions.slaRead, async (ctx) => {
    const query = parseQuery(request, slaPolicyListQuerySchema);
    return jsonOk(await listSlaPolicies(ctx, query));
  });
}

export async function POST(request: Request) {
  return withSupportAuth(request, supportPermissions.slaWrite, async (ctx) => {
    const payload = await parseJson(request, slaPolicyCreateSchema);
    return jsonOk(await createSlaPolicy(ctx, payload), { status: 201 });
  });
}
