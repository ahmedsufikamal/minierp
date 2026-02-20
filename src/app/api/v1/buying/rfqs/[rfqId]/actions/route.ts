import { applyRfqAction } from "@/modules/buying/application/rfqs.service";
import { rfqActionSchema } from "@/modules/buying/domain/schemas";
import { buyingPermissions } from "@/modules/buying/domain/types";
import { jsonOk, parseJson, withBuyingAuth } from "@/modules/buying/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ rfqId: string }> },
) {
  return withBuyingAuth(request, buyingPermissions.rfqWrite, async (ctx) => {
    const { rfqId } = await context.params;
    const payload = await parseJson(request, rfqActionSchema);
    return jsonOk(await applyRfqAction(ctx, rfqId, payload));
  });
}
