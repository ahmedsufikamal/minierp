import {
  createInventoryReservation,
  listInventoryReservations,
} from "@/modules/inventory/application/reservations.service";
import {
  reservationCreateSchema,
  reservationListQuerySchema,
} from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, parseQuery, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    const query = parseQuery(request, reservationListQuerySchema);
    return jsonOk(await listInventoryReservations(ctx, query));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.documentWrite, async (ctx) => {
    const payload = await parseJson(request, reservationCreateSchema);
    return jsonOk(await createInventoryReservation(ctx, payload), { status: 201 });
  });
}
