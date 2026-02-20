import { applyPayrollEntryAction } from "@/modules/payroll/application/payroll-entries.service";
import { payrollEntryActionSchema } from "@/modules/payroll/domain/schemas";
import { payrollPermissions } from "@/modules/payroll/domain/types";
import { jsonOk, parseJson, withPayrollAuth } from "@/modules/payroll/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ entryId: string }> },
) {
  return withPayrollAuth(request, payrollPermissions.payrollEntryPost, async (ctx) => {
    const { entryId } = await context.params;
    const payload = await parseJson(request, payrollEntryActionSchema);
    return jsonOk(await applyPayrollEntryAction(ctx, entryId, payload));
  });
}
