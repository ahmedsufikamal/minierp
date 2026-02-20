import { applySalesOrderAction } from "@/modules/selling/application/sales-orders.service";
import { salesOrderActionSchema } from "@/modules/selling/domain/schemas";
import { sellingPermissions } from "@/modules/selling/domain/types";
import { jsonOk, parseJson, withSellingAuth } from "@/modules/selling/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ salesOrderId: string }> },
) {
  return withSellingAuth(request, sellingPermissions.salesOrderApprove, async (ctx) => {
    const { salesOrderId } = await context.params;
    const payload = await parseJson(request, salesOrderActionSchema);
    return jsonOk(await applySalesOrderAction(ctx, salesOrderId, payload));
  });
}
