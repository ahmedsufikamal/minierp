import { applyCallLogAction } from "@/modules/telephony/application/call-logs.service";
import { callLogActionSchema } from "@/modules/telephony/domain/schemas";
import { telephonyPermissions } from "@/modules/telephony/domain/types";
import { jsonOk, parseJson, withTelephonyAuth } from "@/modules/telephony/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ callLogId: string }> },
) {
  return withTelephonyAuth(request, telephonyPermissions.callManage, async (ctx) => {
    const { callLogId } = await context.params;
    const payload = await parseJson(request, callLogActionSchema);
    return jsonOk(await applyCallLogAction(ctx, callLogId, payload));
  });
}
