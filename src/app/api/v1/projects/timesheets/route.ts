import { createTimesheet, listTimesheets } from "@/modules/projects/application/timesheets.service";
import { timesheetCreateSchema, timesheetListQuerySchema } from "@/modules/projects/domain/schemas";
import { projectsPermissions } from "@/modules/projects/domain/types";
import { jsonOk, parseJson, parseQuery, withProjectsAuth } from "@/modules/projects/interface/http";

export async function GET(request: Request) {
  return withProjectsAuth(request, projectsPermissions.timesheetRead, async (ctx) => {
    const query = parseQuery(request, timesheetListQuerySchema);
    return jsonOk(await listTimesheets(ctx, query));
  });
}

export async function POST(request: Request) {
  return withProjectsAuth(request, projectsPermissions.timesheetWrite, async (ctx) => {
    const payload = await parseJson(request, timesheetCreateSchema);
    return jsonOk(await createTimesheet(ctx, payload), { status: 201 });
  });
}
