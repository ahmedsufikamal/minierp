import { createPayslip, listPayslips } from "@/modules/payroll/application/payslips.service";
import { payslipCreateSchema, payslipListQuerySchema } from "@/modules/payroll/domain/schemas";
import { payrollPermissions } from "@/modules/payroll/domain/types";
import { jsonOk, parseJson, parseQuery, withPayrollAuth } from "@/modules/payroll/interface/http";

export async function GET(request: Request) {
  return withPayrollAuth(request, payrollPermissions.payslipRead, async (ctx) => {
    const query = parseQuery(request, payslipListQuerySchema);
    return jsonOk(await listPayslips(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPayrollAuth(request, payrollPermissions.payslipWrite, async (ctx) => {
    const payload = await parseJson(request, payslipCreateSchema);
    return jsonOk(await createPayslip(ctx, payload), { status: 201 });
  });
}
