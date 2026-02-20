import { applyUtilityTaskAction } from "@/modules/utilities/application/tasks.service";
import { utilityTaskActionSchema } from "@/modules/utilities/domain/schemas";
import { utilitiesPermissions } from "@/modules/utilities/domain/types";
import { jsonOk, parseJson, withUtilitiesAuth } from "@/modules/utilities/interface/http";

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  return withUtilitiesAuth(request, utilitiesPermissions.taskManage, async (ctx) => {
    const { taskId } = await context.params;
    const payload = await parseJson(request, utilityTaskActionSchema);
    return jsonOk(await applyUtilityTaskAction(ctx, taskId, payload));
  });
}
