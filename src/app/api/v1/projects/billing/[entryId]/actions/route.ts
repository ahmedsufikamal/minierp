import { applyProjectBillingAction } from "@/modules/projects/application/billing.service";
import { projectBillingActionSchema } from "@/modules/projects/domain/schemas";
import { projectsPermissions } from "@/modules/projects/domain/types";
import { jsonOk, parseJson, withProjectsAuth } from "@/modules/projects/interface/http";

type Params = {
  params: Promise<{ entryId: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withProjectsAuth(request, projectsPermissions.billingApprove, async (ctx) => {
    const { entryId } = await params;
    const payload = await parseJson(request, projectBillingActionSchema);
    return jsonOk(await applyProjectBillingAction(ctx, entryId, payload));
  });
}
