import { applyPayslipAction } from "@/modules/payroll/application/payslips.service";
import { payslipActionSchema } from "@/modules/payroll/domain/schemas";
import { payrollPermissions } from "@/modules/payroll/domain/types";
import { jsonOk, parseJson, withPayrollAuth } from "@/modules/payroll/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ payslipId: string }> },
) {
  return withPayrollAuth(request, payrollPermissions.payslipPost, async (ctx) => {
    const { payslipId } = await context.params;
    const payload = await parseJson(request, payslipActionSchema);
    return jsonOk(await applyPayslipAction(ctx, payslipId, payload));
  });
}
