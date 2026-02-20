import { createLeaveApplication, listLeaveApplications } from "@/modules/hr/application/leaves.service";
import { leaveApplicationCreateSchema, leaveApplicationListQuerySchema } from "@/modules/hr/domain/schemas";
import { hrPermissions } from "@/modules/hr/domain/types";
import { jsonOk, parseJson, parseQuery, withHrAuth } from "@/modules/hr/interface/http";

export async function GET(request: Request) {
  return withHrAuth(request, hrPermissions.leaveRead, async (ctx) => {
    const query = parseQuery(request, leaveApplicationListQuerySchema);
    return jsonOk(await listLeaveApplications(ctx, query));
  });
}

export async function POST(request: Request) {
  return withHrAuth(request, hrPermissions.leaveWrite, async (ctx) => {
    const payload = await parseJson(request, leaveApplicationCreateSchema);
    return jsonOk(await createLeaveApplication(ctx, payload), { status: 201 });
  });
}
