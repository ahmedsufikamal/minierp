import { applyMaintenanceScheduleAction } from "@/modules/maintenance/application/schedules.service";
import { maintenanceScheduleActionSchema } from "@/modules/maintenance/domain/schemas";
import { maintenancePermissions } from "@/modules/maintenance/domain/types";
import { jsonOk, parseJson, withMaintenanceAuth } from "@/modules/maintenance/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ scheduleId: string }> },
) {
  return withMaintenanceAuth(request, maintenancePermissions.scheduleManage, async (ctx) => {
    const { scheduleId } = await context.params;
    const payload = await parseJson(request, maintenanceScheduleActionSchema);
    return jsonOk(await applyMaintenanceScheduleAction(ctx, scheduleId, payload));
  });
}
