import { createInventoryDocument, listInventoryDocuments } from "@/modules/inventory/application/documents.service";
import { documentListQuerySchema, documentUpsertSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, parseQuery, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.documentRead, async (ctx) => {
    const query = parseQuery(request, documentListQuerySchema);
    return jsonOk(await listInventoryDocuments(ctx, query));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.documentWrite, async (ctx) => {
    const payload = await parseJson(request, documentUpsertSchema);
    return jsonOk(await createInventoryDocument(ctx, payload), { status: 201 });
  });
}
