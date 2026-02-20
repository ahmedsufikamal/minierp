import { applyDeliveryNoteAction } from "@/modules/selling/application/delivery-notes.service";
import { deliveryNoteActionSchema } from "@/modules/selling/domain/schemas";
import { sellingPermissions } from "@/modules/selling/domain/types";
import { jsonOk, parseJson, withSellingAuth } from "@/modules/selling/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ deliveryNoteId: string }> },
) {
  return withSellingAuth(request, sellingPermissions.deliveryNotePost, async (ctx) => {
    const { deliveryNoteId } = await context.params;
    const payload = await parseJson(request, deliveryNoteActionSchema);
    return jsonOk(await applyDeliveryNoteAction(ctx, deliveryNoteId, payload));
  });
}
