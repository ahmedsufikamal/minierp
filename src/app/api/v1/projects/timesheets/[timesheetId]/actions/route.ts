import { applyTimesheetAction } from "@/modules/projects/application/timesheets.service";
import { timesheetActionSchema } from "@/modules/projects/domain/schemas";
import { projectsPermissions } from "@/modules/projects/domain/types";
import { jsonOk, parseJson, withProjectsAuth } from "@/modules/projects/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ timesheetId: string }> },
) {
  return withProjectsAuth(request, projectsPermissions.timesheetApprove, async (ctx) => {
    const { timesheetId } = await context.params;
    const payload = await parseJson(request, timesheetActionSchema);
    return jsonOk(await applyTimesheetAction(ctx, timesheetId, payload));
  });
}
