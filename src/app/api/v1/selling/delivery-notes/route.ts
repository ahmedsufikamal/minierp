import { createDeliveryNote, listDeliveryNotes } from "@/modules/selling/application/delivery-notes.service";
import { deliveryNoteCreateSchema, deliveryNoteListQuerySchema } from "@/modules/selling/domain/schemas";
import { sellingPermissions } from "@/modules/selling/domain/types";
import { jsonOk, parseJson, parseQuery, withSellingAuth } from "@/modules/selling/interface/http";

export async function GET(request: Request) {
  return withSellingAuth(request, sellingPermissions.deliveryNoteRead, async (ctx) => {
    const query = parseQuery(request, deliveryNoteListQuerySchema);
    return jsonOk(await listDeliveryNotes(ctx, query));
  });
}

export async function POST(request: Request) {
  return withSellingAuth(request, sellingPermissions.deliveryNoteWrite, async (ctx) => {
    const payload = await parseJson(request, deliveryNoteCreateSchema);
    return jsonOk(await createDeliveryNote(ctx, payload), { status: 201 });
  });
}
