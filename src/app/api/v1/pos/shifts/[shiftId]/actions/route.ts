import { applyPosShiftAction } from "@/modules/pos/application/shifts.service";
import { posShiftActionSchema } from "@/modules/pos/domain/schemas";
import { posPermissions } from "@/modules/pos/domain/types";
import { jsonOk, parseJson, withPosAuth } from "@/modules/pos/interface/http";

export async function PATCH(request: Request, context: { params: Promise<{ shiftId: string }> }) {
  return withPosAuth(request, posPermissions.shiftManage, async (ctx) => {
    const { shiftId } = await context.params;
    const payload = await parseJson(request, posShiftActionSchema);
    return jsonOk(await applyPosShiftAction(ctx, shiftId, payload));
  });
}
