import { applyProjectTaskAction } from "@/modules/projects/application/tasks.service";
import { projectTaskActionSchema } from "@/modules/projects/domain/schemas";
import { projectsPermissions } from "@/modules/projects/domain/types";
import { jsonOk, parseJson, withProjectsAuth } from "@/modules/projects/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  return withProjectsAuth(request, projectsPermissions.taskApprove, async (ctx) => {
    const { taskId } = await context.params;
    const payload = await parseJson(request, projectTaskActionSchema);
    return jsonOk(await applyProjectTaskAction(ctx, taskId, payload));
  });
}
