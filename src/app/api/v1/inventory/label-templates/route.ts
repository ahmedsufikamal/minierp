import { createLabelTemplate, listLabelTemplates } from "@/modules/inventory/application/label-templates.service";
import { labelTemplateSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsRead, async (ctx) => {
    return jsonOk(await listLabelTemplates(ctx));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const payload = await parseJson(request, labelTemplateSchema);
    return jsonOk(await createLabelTemplate(ctx, payload), { status: 201 });
  });
}
