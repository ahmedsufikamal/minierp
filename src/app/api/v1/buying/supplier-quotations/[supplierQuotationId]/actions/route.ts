import { applySupplierQuotationAction } from "@/modules/buying/application/supplier-quotations.service";
import { supplierQuotationActionSchema } from "@/modules/buying/domain/schemas";
import { buyingPermissions } from "@/modules/buying/domain/types";
import { jsonOk, parseJson, withBuyingAuth } from "@/modules/buying/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ supplierQuotationId: string }> },
) {
  return withBuyingAuth(request, buyingPermissions.supplierQuotationWrite, async (ctx) => {
    const { supplierQuotationId } = await context.params;
    const payload = await parseJson(request, supplierQuotationActionSchema);
    return jsonOk(await applySupplierQuotationAction(ctx, supplierQuotationId, payload));
  });
}
