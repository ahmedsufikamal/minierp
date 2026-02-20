import {
  createProjectBillingEntry,
  listProjectBillingEntries,
} from "@/modules/projects/application/billing.service";
import { projectBillingCreateSchema, projectBillingListQuerySchema } from "@/modules/projects/domain/schemas";
import { projectsPermissions } from "@/modules/projects/domain/types";
import { jsonOk, parseJson, parseQuery, withProjectsAuth } from "@/modules/projects/interface/http";

export async function GET(request: Request) {
  return withProjectsAuth(request, projectsPermissions.billingRead, async (ctx) => {
    const query = parseQuery(request, projectBillingListQuerySchema);
    return jsonOk(await listProjectBillingEntries(ctx, query));
  });
}

export async function POST(request: Request) {
  return withProjectsAuth(request, projectsPermissions.billingWrite, async (ctx) => {
    const payload = await parseJson(request, projectBillingCreateSchema);
    return jsonOk(await createProjectBillingEntry(ctx, payload), { status: 201 });
  });
}
