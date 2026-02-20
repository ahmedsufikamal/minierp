import {
  createEdiTransport,
  listEdiTransports,
} from "@/modules/edi/application/transports.service";
import { ediTransportCreateSchema, ediTransportQuerySchema } from "@/modules/edi/domain/schemas";
import { ediPermissions } from "@/modules/edi/domain/types";
import { jsonOk, parseJson, parseQuery, withEdiAuth } from "@/modules/edi/interface/http";

export async function GET(request: Request) {
  return withEdiAuth(request, ediPermissions.transportRead, async (ctx) => {
    const query = parseQuery(request, ediTransportQuerySchema);
    return jsonOk(await listEdiTransports(ctx, query));
  });
}

export async function POST(request: Request) {
  return withEdiAuth(request, ediPermissions.transportWrite, async (ctx) => {
    const payload = await parseJson(request, ediTransportCreateSchema);
    return jsonOk(await createEdiTransport(ctx, payload), { status: 201 });
  });
}
