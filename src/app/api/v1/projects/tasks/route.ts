import { createProjectTask, listProjectTasks } from "@/modules/projects/application/tasks.service";
import { projectTaskCreateSchema, projectTaskListQuerySchema } from "@/modules/projects/domain/schemas";
import { projectsPermissions } from "@/modules/projects/domain/types";
import { jsonOk, parseJson, parseQuery, withProjectsAuth } from "@/modules/projects/interface/http";

export async function GET(request: Request) {
  return withProjectsAuth(request, projectsPermissions.taskRead, async (ctx) => {
    const query = parseQuery(request, projectTaskListQuerySchema);
    return jsonOk(await listProjectTasks(ctx, query));
  });
}

export async function POST(request: Request) {
  return withProjectsAuth(request, projectsPermissions.taskWrite, async (ctx) => {
    const payload = await parseJson(request, projectTaskCreateSchema);
    return jsonOk(await createProjectTask(ctx, payload), { status: 201 });
  });
}
