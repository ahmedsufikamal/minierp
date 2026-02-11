import { getInventoryDocument, updateInventoryDocument } from "@/modules/inventory/application/documents.service";
import { documentUpsertSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request, props: { params: Promise<{ docId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.documentRead, async (ctx) => {
    const { docId } = await props.params;
    return jsonOk(await getInventoryDocument(ctx, docId));
  });
}

export async function PATCH(request: Request, props: { params: Promise<{ docId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.documentWrite, async (ctx) => {
    const { docId } = await props.params;
    const payload = await parseJson(request, documentUpsertSchema.partial());
    return jsonOk(await updateInventoryDocument(ctx, docId, payload));
  });
}
