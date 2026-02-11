import { createViewPreset, listViewPresets } from "@/modules/inventory/application/view-presets.service";
import { viewPresetSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    const entity = new URL(request.url).searchParams.get("entity") || undefined;
    return jsonOk(await listViewPresets(ctx, entity));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    const payload = await parseJson(request, viewPresetSchema);
    return jsonOk(await createViewPreset(ctx, payload), { status: 201 });
  });
}
