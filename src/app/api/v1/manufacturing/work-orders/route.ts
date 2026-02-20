import { createWorkOrder, listWorkOrders } from "@/modules/manufacturing/application/work-orders.service";
import { workOrderActionSchema, workOrderCreateSchema, workOrderListQuerySchema } from "@/modules/manufacturing/domain/schemas";
import { manufacturingPermissions } from "@/modules/manufacturing/domain/types";
import { jsonOk, parseJson, parseQuery, withManufacturingAuth } from "@/modules/manufacturing/interface/http";

export async function GET(request: Request) {
  return withManufacturingAuth(request, manufacturingPermissions.workOrderRead, async (ctx) => {
    const query = parseQuery(request, workOrderListQuerySchema);
    return jsonOk(await listWorkOrders(ctx, query));
  });
}

export async function POST(request: Request) {
  return withManufacturingAuth(request, manufacturingPermissions.workOrderWrite, async (ctx) => {
    const payload = await parseJson(request, workOrderCreateSchema);
    return jsonOk(await createWorkOrder(ctx, payload), { status: 201 });
  });
}
