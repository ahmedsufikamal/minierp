import { InventoryCustomFieldEntityType } from "@prisma/client";
import { createCustomFieldDefinition, listCustomFieldDefinitions } from "@/modules/inventory/application/custom-fields.service";
import { customFieldDefinitionSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsRead, async (ctx) => {
    const raw = new URL(request.url).searchParams.get("entityType");
    const entityType = raw && raw in InventoryCustomFieldEntityType ? (raw as InventoryCustomFieldEntityType) : undefined;
    return jsonOk(await listCustomFieldDefinitions(ctx, entityType));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const payload = await parseJson(request, customFieldDefinitionSchema);
    return jsonOk(await createCustomFieldDefinition(ctx, payload), { status: 201 });
  });
}
