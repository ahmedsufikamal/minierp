import { createMaintenanceSchedule, listMaintenanceSchedules } from "@/modules/maintenance/application/schedules.service";
import { maintenanceScheduleCreateSchema, maintenanceScheduleListQuerySchema } from "@/modules/maintenance/domain/schemas";
import { maintenancePermissions } from "@/modules/maintenance/domain/types";
import { jsonOk, parseJson, parseQuery, withMaintenanceAuth } from "@/modules/maintenance/interface/http";

export async function GET(request: Request) {
  return withMaintenanceAuth(request, maintenancePermissions.scheduleRead, async (ctx) => {
    const query = parseQuery(request, maintenanceScheduleListQuerySchema);
    return jsonOk(await listMaintenanceSchedules(ctx, query));
  });
}

export async function POST(request: Request) {
  return withMaintenanceAuth(request, maintenancePermissions.scheduleWrite, async (ctx) => {
    const payload = await parseJson(request, maintenanceScheduleCreateSchema);
    return jsonOk(await createMaintenanceSchedule(ctx, payload), { status: 201 });
  });
}
