import { releaseInventoryReservation } from "@/modules/inventory/application/reservations.service";
import { reservationReleaseSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function POST(
  request: Request,
  props: { params: Promise<{ reservationId: string }> },
) {
  return withInventoryAuth(request, inventoryPermissions.documentWrite, async (ctx) => {
    const { reservationId } = await props.params;
    const payload = await parseJson(request, reservationReleaseSchema);
    return jsonOk(await releaseInventoryReservation(ctx, reservationId, payload));
  });
}
