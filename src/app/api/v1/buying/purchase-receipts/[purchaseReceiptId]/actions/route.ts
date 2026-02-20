import { applyPurchaseReceiptAction } from "@/modules/buying/application/purchase-receipts.service";
import { purchaseReceiptActionSchema } from "@/modules/buying/domain/schemas";
import { buyingPermissions } from "@/modules/buying/domain/types";
import { jsonOk, parseJson, withBuyingAuth } from "@/modules/buying/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ purchaseReceiptId: string }> },
) {
  return withBuyingAuth(request, buyingPermissions.purchaseReceiptPost, async (ctx) => {
    const { purchaseReceiptId } = await context.params;
    const payload = await parseJson(request, purchaseReceiptActionSchema);
    return jsonOk(await applyPurchaseReceiptAction(ctx, purchaseReceiptId, payload));
  });
}
