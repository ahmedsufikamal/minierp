import { InventoryCustomFieldEntityType } from "@prisma/client";
import { exportCustomFieldSchema, importCustomFieldSchema } from "@/modules/inventory/application/custom-fields.service";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsRead, async (ctx) => {
    const raw = new URL(request.url).searchParams.get("entityType");
    const entityType = raw && raw in InventoryCustomFieldEntityType ? (raw as InventoryCustomFieldEntityType) : undefined;
    return jsonOk(await exportCustomFieldSchema(ctx, entityType));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const body = (await request.json().catch(() => ({}))) as { rows?: unknown[] };
    const rows = Array.isArray(body.rows) ? body.rows : [];
    return jsonOk(await importCustomFieldSchema(ctx, rows));
  });
}
