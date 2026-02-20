import { applyProjectAction } from "@/modules/projects/application/projects.service";
import { projectActionSchema } from "@/modules/projects/domain/schemas";
import { projectsPermissions } from "@/modules/projects/domain/types";
import { jsonOk, parseJson, withProjectsAuth } from "@/modules/projects/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  return withProjectsAuth(request, projectsPermissions.projectApprove, async (ctx) => {
    const { projectId } = await context.params;
    const payload = await parseJson(request, projectActionSchema);
    return jsonOk(await applyProjectAction(ctx, projectId, payload));
  });
}
