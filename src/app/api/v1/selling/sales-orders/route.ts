import { createSalesOrder, listSalesOrders } from "@/modules/selling/application/sales-orders.service";
import { salesOrderCreateSchema, salesOrderListQuerySchema } from "@/modules/selling/domain/schemas";
import { sellingPermissions } from "@/modules/selling/domain/types";
import { jsonOk, parseJson, parseQuery, withSellingAuth } from "@/modules/selling/interface/http";

export async function GET(request: Request) {
  return withSellingAuth(request, sellingPermissions.salesOrderRead, async (ctx) => {
    const query = parseQuery(request, salesOrderListQuerySchema);
    return jsonOk(await listSalesOrders(ctx, query));
  });
}

export async function POST(request: Request) {
  return withSellingAuth(request, sellingPermissions.salesOrderWrite, async (ctx) => {
    const payload = await parseJson(request, salesOrderCreateSchema);
    return jsonOk(await createSalesOrder(ctx, payload), { status: 201 });
  });
}
