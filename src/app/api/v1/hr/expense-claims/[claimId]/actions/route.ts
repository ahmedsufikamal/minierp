import { applyExpenseClaimAction } from "@/modules/hr/application/expense-claims.service";
import { expenseClaimActionSchema } from "@/modules/hr/domain/schemas";
import { hrPermissions } from "@/modules/hr/domain/types";
import { jsonOk, parseJson, withHrAuth } from "@/modules/hr/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ claimId: string }> },
) {
  return withHrAuth(request, hrPermissions.expenseApprove, async (ctx) => {
    const { claimId } = await context.params;
    const payload = await parseJson(request, expenseClaimActionSchema);
    return jsonOk(await applyExpenseClaimAction(ctx, claimId, payload));
  });
}
