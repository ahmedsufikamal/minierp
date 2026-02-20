import { createProject, listProjects } from "@/modules/projects/application/projects.service";
import { projectCreateSchema, projectListQuerySchema } from "@/modules/projects/domain/schemas";
import { projectsPermissions } from "@/modules/projects/domain/types";
import { jsonOk, parseJson, parseQuery, withProjectsAuth } from "@/modules/projects/interface/http";

export async function GET(request: Request) {
  return withProjectsAuth(request, projectsPermissions.projectRead, async (ctx) => {
    const query = parseQuery(request, projectListQuerySchema);
    return jsonOk(await listProjects(ctx, query));
  });
}

export async function POST(request: Request) {
  return withProjectsAuth(request, projectsPermissions.projectWrite, async (ctx) => {
    const payload = await parseJson(request, projectCreateSchema);
    return jsonOk(await createProject(ctx, payload), { status: 201 });
  });
}
