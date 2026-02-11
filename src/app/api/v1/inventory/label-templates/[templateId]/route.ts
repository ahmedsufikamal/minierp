import { deleteLabelTemplate, updateLabelTemplate } from "@/modules/inventory/application/label-templates.service";
import { labelTemplateSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function PATCH(request: Request, props: { params: Promise<{ templateId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const { templateId } = await props.params;
    const payload = await parseJson(request, labelTemplateSchema.partial());
    return jsonOk(await updateLabelTemplate(ctx, templateId, payload));
  });
}

export async function DELETE(request: Request, props: { params: Promise<{ templateId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const { templateId } = await props.params;
    await deleteLabelTemplate(ctx, templateId);
    return jsonOk({ deleted: true });
  });
}
