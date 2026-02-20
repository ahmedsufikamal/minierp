import {
  getInventoryCompanySettings,
  updateInventoryCompanySettings,
} from "@/modules/inventory/application/settings.service";
import { inventoryCompanySettingsSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsRead, async (ctx) => {
    return jsonOk(await getInventoryCompanySettings(ctx));
  });
}

export async function PATCH(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const payload = await parseJson(request, inventoryCompanySettingsSchema.partial());
    return jsonOk(await updateInventoryCompanySettings(ctx, payload));
  });
}
