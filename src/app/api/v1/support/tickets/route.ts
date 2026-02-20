import { createTicket, listTickets } from "@/modules/support/application/tickets.service";
import { ticketCreateSchema, ticketListQuerySchema } from "@/modules/support/domain/schemas";
import { supportPermissions } from "@/modules/support/domain/types";
import { jsonOk, parseJson, parseQuery, withSupportAuth } from "@/modules/support/interface/http";

export async function GET(request: Request) {
  return withSupportAuth(request, supportPermissions.ticketRead, async (ctx) => {
    const query = parseQuery(request, ticketListQuerySchema);
    return jsonOk(await listTickets(ctx, query));
  });
}

export async function POST(request: Request) {
  return withSupportAuth(request, supportPermissions.ticketWrite, async (ctx) => {
    const payload = await parseJson(request, ticketCreateSchema);
    return jsonOk(await createTicket(ctx, payload), { status: 201 });
  });
}
