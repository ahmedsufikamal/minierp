import { applyQualityInspectionAction } from "@/modules/quality/application/inspections.service";
import { qualityInspectionActionSchema } from "@/modules/quality/domain/schemas";
import { qualityPermissions } from "@/modules/quality/domain/types";
import { jsonOk, parseJson, withQualityAuth } from "@/modules/quality/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ inspectionId: string }> },
) {
  return withQualityAuth(request, qualityPermissions.inspectionApprove, async (ctx) => {
    const { inspectionId } = await context.params;
    const payload = await parseJson(request, qualityInspectionActionSchema);
    return jsonOk(await applyQualityInspectionAction(ctx, inspectionId, payload));
  });
}
