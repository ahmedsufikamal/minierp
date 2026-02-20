import { createCommunicationWindow, listCommunicationWindows } from "@/modules/communication/application/windows.service";
import { communicationWindowCreateSchema, communicationWindowListQuerySchema } from "@/modules/communication/domain/schemas";
import { communicationPermissions } from "@/modules/communication/domain/types";
import { jsonOk, parseJson, parseQuery, withCommunicationAuth } from "@/modules/communication/interface/http";

export async function GET(request: Request) {
  return withCommunicationAuth(request, communicationPermissions.windowRead, async (ctx) => {
    const query = parseQuery(request, communicationWindowListQuerySchema);
    return jsonOk(await listCommunicationWindows(ctx, query));
  });
}

export async function POST(request: Request) {
  return withCommunicationAuth(request, communicationPermissions.windowWrite, async (ctx) => {
    const payload = await parseJson(request, communicationWindowCreateSchema);
    return jsonOk(await createCommunicationWindow(ctx, payload), { status: 201 });
  });
}
