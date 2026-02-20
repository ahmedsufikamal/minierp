import { applyQualityCapaAction } from "@/modules/quality/application/capas.service";
import { qualityCapaActionSchema } from "@/modules/quality/domain/schemas";
import { qualityPermissions } from "@/modules/quality/domain/types";
import { jsonOk, parseJson, withQualityAuth } from "@/modules/quality/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ capaId: string }> },
) {
  return withQualityAuth(request, qualityPermissions.capaClose, async (ctx) => {
    const { capaId } = await context.params;
    const payload = await parseJson(request, qualityCapaActionSchema);
    return jsonOk(await applyQualityCapaAction(ctx, capaId, payload));
  });
}
