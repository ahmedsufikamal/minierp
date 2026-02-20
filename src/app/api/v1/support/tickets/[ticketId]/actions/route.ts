import { applyTicketAction } from "@/modules/support/application/tickets.service";
import { ticketActionSchema } from "@/modules/support/domain/schemas";
import { supportPermissions } from "@/modules/support/domain/types";
import { jsonOk, parseJson, withSupportAuth } from "@/modules/support/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  return withSupportAuth(request, supportPermissions.ticketManage, async (ctx) => {
    const { ticketId } = await context.params;
    const payload = await parseJson(request, ticketActionSchema);
    return jsonOk(await applyTicketAction(ctx, ticketId, payload));
  });
}
