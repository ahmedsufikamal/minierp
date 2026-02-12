import { InventoryCustomFieldEntityType } from "@prisma/client";
import { exportCustomFieldSchema, importCustomFieldSchema } from "@/modules/inventory/application/custom-fields.service";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";
import { z } from "zod";

const importSchema = z.object({
  rows: z.array(z.unknown()).default([]),
});

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsRead, async (ctx) => {
    const raw = new URL(request.url).searchParams.get("entityType");
    const entityType = raw && raw in InventoryCustomFieldEntityType ? (raw as InventoryCustomFieldEntityType) : undefined;
    return jsonOk(await exportCustomFieldSchema(ctx, entityType));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const body = await parseJson(request, importSchema);
    return jsonOk(await importCustomFieldSchema(ctx, body.rows));
  });
}
