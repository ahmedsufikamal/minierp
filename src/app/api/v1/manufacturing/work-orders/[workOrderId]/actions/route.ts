import { applyWorkOrderAction } from "@/modules/manufacturing/application/work-orders.service";
import { workOrderActionSchema } from "@/modules/manufacturing/domain/schemas";
import { manufacturingPermissions } from "@/modules/manufacturing/domain/types";
import { jsonOk, parseJson, withManufacturingAuth } from "@/modules/manufacturing/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workOrderId: string }> },
) {
  return withManufacturingAuth(request, manufacturingPermissions.workOrderRelease, async (ctx) => {
    const { workOrderId } = await context.params;
    const payload = await parseJson(request, workOrderActionSchema);
    return jsonOk(await applyWorkOrderAction(ctx, workOrderId, payload));
  });
}
