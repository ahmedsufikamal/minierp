import { listInventoryBalances } from "@/modules/inventory/application/documents.service";
import { ledgerQuerySchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseQuery, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.ledgerRead, async (ctx) => {
    const query = parseQuery(request, ledgerQuerySchema.partial());
    return jsonOk(await listInventoryBalances(ctx, query));
  });
}
