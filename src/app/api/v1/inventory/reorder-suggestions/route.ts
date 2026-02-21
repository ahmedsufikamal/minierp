import { getReorderSuggestions, publishReorderSuggestionAlerts } from "@/modules/inventory/application/reorder.service";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    return jsonOk(await getReorderSuggestions(ctx));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const payload = (await request.json().catch(() => ({}))) as { dedupeWindowHours?: number };
    return jsonOk(
      await publishReorderSuggestionAlerts(ctx, {
        dedupeWindowHours: payload.dedupeWindowHours,
      }),
    );
  });
}
