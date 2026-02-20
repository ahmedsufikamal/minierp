import { createCommunicationLog, listCommunicationLogs } from "@/modules/communication/application/logs.service";
import { communicationLogCreateSchema, communicationLogListQuerySchema } from "@/modules/communication/domain/schemas";
import { communicationPermissions } from "@/modules/communication/domain/types";
import { jsonOk, parseJson, parseQuery, withCommunicationAuth } from "@/modules/communication/interface/http";

export async function GET(request: Request) {
  return withCommunicationAuth(request, communicationPermissions.logRead, async (ctx) => {
    const query = parseQuery(request, communicationLogListQuerySchema);
    return jsonOk(await listCommunicationLogs(ctx, query));
  });
}

export async function POST(request: Request) {
  return withCommunicationAuth(request, communicationPermissions.logWrite, async (ctx) => {
    const payload = await parseJson(request, communicationLogCreateSchema);
    return jsonOk(await createCommunicationLog(ctx, payload), { status: 201 });
  });
}
