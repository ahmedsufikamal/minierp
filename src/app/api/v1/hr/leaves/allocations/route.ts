import { createLeaveAllocation, listLeaveAllocations } from "@/modules/hr/application/leaves.service";
import { leaveAllocationCreateSchema, leaveAllocationListQuerySchema } from "@/modules/hr/domain/schemas";
import { hrPermissions } from "@/modules/hr/domain/types";
import { jsonOk, parseJson, parseQuery, withHrAuth } from "@/modules/hr/interface/http";

export async function GET(request: Request) {
  return withHrAuth(request, hrPermissions.leaveRead, async (ctx) => {
    const query = parseQuery(request, leaveAllocationListQuerySchema);
    return jsonOk(await listLeaveAllocations(ctx, query));
  });
}

export async function POST(request: Request) {
  return withHrAuth(request, hrPermissions.leaveWrite, async (ctx) => {
    const payload = await parseJson(request, leaveAllocationCreateSchema);
    return jsonOk(await createLeaveAllocation(ctx, payload), { status: 201 });
  });
}
