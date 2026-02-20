import { applySupplierPaymentAction } from "@/modules/buying/application/payables.service";
import { supplierPaymentActionSchema } from "@/modules/buying/domain/schemas";
import { buyingPermissions } from "@/modules/buying/domain/types";
import { jsonOk, parseJson, withBuyingAuth } from "@/modules/buying/interface/http";

type Params = {
  params: Promise<{ paymentId: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withBuyingAuth(request, buyingPermissions.supplierPaymentPost, async (ctx) => {
    const { paymentId } = await params;
    const payload = await parseJson(request, supplierPaymentActionSchema);
    return jsonOk(await applySupplierPaymentAction(ctx, paymentId, payload));
  });
}
