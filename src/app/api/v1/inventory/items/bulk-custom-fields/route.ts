import { bulkSetCustomFieldValues } from "@/modules/inventory/application/custom-fields.service";
import { bulkCustomFieldUpdateSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function PATCH(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemWrite, async (ctx) => {
    const payload = await parseJson(request, bulkCustomFieldUpdateSchema);
    await bulkSetCustomFieldValues(ctx, payload);
    return jsonOk({ updated: payload.updates.length });
  });
}
