import { applyLeaveApplicationAction } from "@/modules/hr/application/leaves.service";
import { leaveApplicationActionSchema } from "@/modules/hr/domain/schemas";
import { hrPermissions } from "@/modules/hr/domain/types";
import { jsonOk, parseJson, withHrAuth } from "@/modules/hr/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withHrAuth(request, hrPermissions.leaveApprove, async (ctx) => {
    const { applicationId } = await context.params;
    const payload = await parseJson(request, leaveApplicationActionSchema);
    return jsonOk(await applyLeaveApplicationAction(ctx, applicationId, payload));
  });
}
