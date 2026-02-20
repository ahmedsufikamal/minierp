import { applySubcontractingReceiptAction } from "@/modules/subcontracting/application/receipts.service";
import { subcontractingReceiptActionSchema } from "@/modules/subcontracting/domain/schemas";
import { subcontractingPermissions } from "@/modules/subcontracting/domain/types";
import { jsonOk, parseJson, withSubcontractingAuth } from "@/modules/subcontracting/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ receiptId: string }> },
) {
  return withSubcontractingAuth(request, subcontractingPermissions.receiptAccept, async (ctx) => {
    const { receiptId } = await context.params;
    const payload = await parseJson(request, subcontractingReceiptActionSchema);
    return jsonOk(await applySubcontractingReceiptAction(ctx, receiptId, payload));
  });
}
