import { applyQualityGoalAction } from "@/modules/quality/application/goals.service";
import { qualityGoalActionSchema } from "@/modules/quality/domain/schemas";
import { qualityPermissions } from "@/modules/quality/domain/types";
import { jsonOk, parseJson, withQualityAuth } from "@/modules/quality/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ goalId: string }> },
) {
  return withQualityAuth(request, qualityPermissions.goalManage, async (ctx) => {
    const { goalId } = await context.params;
    const payload = await parseJson(request, qualityGoalActionSchema);
    return jsonOk(await applyQualityGoalAction(ctx, goalId, payload));
  });
}
