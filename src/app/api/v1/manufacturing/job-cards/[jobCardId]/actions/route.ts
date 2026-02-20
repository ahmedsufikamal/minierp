import { applyJobCardAction } from "@/modules/manufacturing/application/job-cards.service";
import { jobCardActionSchema } from "@/modules/manufacturing/domain/schemas";
import { manufacturingPermissions } from "@/modules/manufacturing/domain/types";
import { jsonOk, parseJson, withManufacturingAuth } from "@/modules/manufacturing/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ jobCardId: string }> },
) {
  return withManufacturingAuth(request, manufacturingPermissions.jobCardComplete, async (ctx) => {
    const { jobCardId } = await context.params;
    const payload = await parseJson(request, jobCardActionSchema);
    return jsonOk(await applyJobCardAction(ctx, jobCardId, payload));
  });
}
