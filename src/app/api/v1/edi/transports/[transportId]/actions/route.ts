import { applyEdiTransportAction } from "@/modules/edi/application/transports.service";
import { ediTransportActionSchema } from "@/modules/edi/domain/schemas";
import { ediPermissions } from "@/modules/edi/domain/types";
import { jsonOk, parseJson, withEdiAuth } from "@/modules/edi/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ transportId: string }> },
) {
  return withEdiAuth(request, ediPermissions.transportManage, async (ctx) => {
    const { transportId } = await context.params;
    const payload = await parseJson(request, ediTransportActionSchema);
    return jsonOk(await applyEdiTransportAction(ctx, transportId, payload));
  });
}
