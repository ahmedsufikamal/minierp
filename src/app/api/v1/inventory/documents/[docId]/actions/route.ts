import { applyInventoryDocumentAction } from "@/modules/inventory/application/documents.service";
import { documentActionSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function POST(request: Request, props: { params: Promise<{ docId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.documentWrite, async (ctx) => {
    const { docId } = await props.params;
    const payload = await parseJson(request, documentActionSchema);
    return jsonOk(await applyInventoryDocumentAction(ctx, docId, payload));
  });
}
