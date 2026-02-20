import { createSubcontractingOrder, listSubcontractingOrders } from "@/modules/subcontracting/application/orders.service";
import {
  subcontractingOrderCreateSchema,
  subcontractingOrderListQuerySchema,
} from "@/modules/subcontracting/domain/schemas";
import { subcontractingPermissions } from "@/modules/subcontracting/domain/types";
import { jsonOk, parseJson, parseQuery, withSubcontractingAuth } from "@/modules/subcontracting/interface/http";

export async function GET(request: Request) {
  return withSubcontractingAuth(request, subcontractingPermissions.orderRead, async (ctx) => {
    const query = parseQuery(request, subcontractingOrderListQuerySchema);
    return jsonOk(await listSubcontractingOrders(ctx, query));
  });
}

export async function POST(request: Request) {
  return withSubcontractingAuth(request, subcontractingPermissions.orderWrite, async (ctx) => {
    const payload = await parseJson(request, subcontractingOrderCreateSchema);
    return jsonOk(await createSubcontractingOrder(ctx, payload), { status: 201 });
  });
}
