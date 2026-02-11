import { archiveCustomFieldDefinition, updateCustomFieldDefinition } from "@/modules/inventory/application/custom-fields.service";
import { customFieldDefinitionSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function PATCH(request: Request, props: { params: Promise<{ fieldId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const { fieldId } = await props.params;
    const payload = await parseJson(request, customFieldDefinitionSchema.partial());
    return jsonOk(await updateCustomFieldDefinition(ctx, fieldId, payload));
  });
}

export async function DELETE(request: Request, props: { params: Promise<{ fieldId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const { fieldId } = await props.params;
    return jsonOk(await archiveCustomFieldDefinition(ctx, fieldId));
  });
}
