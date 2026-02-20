import { createUtilityTask, listUtilityTasks } from "@/modules/utilities/application/tasks.service";
import {
  utilityTaskCreateSchema,
  utilityTaskListQuerySchema,
} from "@/modules/utilities/domain/schemas";
import { utilitiesPermissions } from "@/modules/utilities/domain/types";
import {
  jsonOk,
  parseJson,
  parseQuery,
  withUtilitiesAuth,
} from "@/modules/utilities/interface/http";

export async function GET(request: Request) {
  return withUtilitiesAuth(request, utilitiesPermissions.taskRead, async (ctx) => {
    const query = parseQuery(request, utilityTaskListQuerySchema);
    return jsonOk(await listUtilityTasks(ctx, query));
  });
}

export async function POST(request: Request) {
  return withUtilitiesAuth(request, utilitiesPermissions.taskWrite, async (ctx) => {
    const payload = await parseJson(request, utilityTaskCreateSchema);
    return jsonOk(await createUtilityTask(ctx, payload), { status: 201 });
  });
}
