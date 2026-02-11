import { deleteViewPreset, updateViewPreset } from "@/modules/inventory/application/view-presets.service";
import { viewPresetSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function PATCH(request: Request, props: { params: Promise<{ presetId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    const { presetId } = await props.params;
    const payload = await parseJson(request, viewPresetSchema.partial());
    return jsonOk(await updateViewPreset(ctx, presetId, payload));
  });
}

export async function DELETE(request: Request, props: { params: Promise<{ presetId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    const { presetId } = await props.params;
    await deleteViewPreset(ctx, presetId);
    return jsonOk({ deleted: true });
  });
}
