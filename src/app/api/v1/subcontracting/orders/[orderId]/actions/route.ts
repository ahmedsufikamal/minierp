import { applySubcontractingOrderAction } from "@/modules/subcontracting/application/orders.service";
import { subcontractingOrderActionSchema } from "@/modules/subcontracting/domain/schemas";
import { subcontractingPermissions } from "@/modules/subcontracting/domain/types";
import { jsonOk, parseJson, withSubcontractingAuth } from "@/modules/subcontracting/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  return withSubcontractingAuth(request, subcontractingPermissions.orderApprove, async (ctx) => {
    const { orderId } = await context.params;
    const payload = await parseJson(request, subcontractingOrderActionSchema);
    return jsonOk(await applySubcontractingOrderAction(ctx, orderId, payload));
  });
}
