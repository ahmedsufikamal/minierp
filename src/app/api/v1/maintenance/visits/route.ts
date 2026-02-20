import { createMaintenanceVisit, listMaintenanceVisits } from "@/modules/maintenance/application/visits.service";
import { maintenanceVisitCreateSchema, maintenanceVisitListQuerySchema } from "@/modules/maintenance/domain/schemas";
import { maintenancePermissions } from "@/modules/maintenance/domain/types";
import { jsonOk, parseJson, parseQuery, withMaintenanceAuth } from "@/modules/maintenance/interface/http";

export async function GET(request: Request) {
  return withMaintenanceAuth(request, maintenancePermissions.visitRead, async (ctx) => {
    const query = parseQuery(request, maintenanceVisitListQuerySchema);
    return jsonOk(await listMaintenanceVisits(ctx, query));
  });
}

export async function POST(request: Request) {
  return withMaintenanceAuth(request, maintenancePermissions.visitWrite, async (ctx) => {
    const payload = await parseJson(request, maintenanceVisitCreateSchema);
    return jsonOk(await createMaintenanceVisit(ctx, payload), { status: 201 });
  });
}
