import { createSalaryStructure, listSalaryStructures } from "@/modules/payroll/application/salary-structures.service";
import { salaryStructureCreateSchema, salaryStructureListQuerySchema } from "@/modules/payroll/domain/schemas";
import { payrollPermissions } from "@/modules/payroll/domain/types";
import { jsonOk, parseJson, parseQuery, withPayrollAuth } from "@/modules/payroll/interface/http";

export async function GET(request: Request) {
  return withPayrollAuth(request, payrollPermissions.salaryStructureRead, async (ctx) => {
    const query = parseQuery(request, salaryStructureListQuerySchema);
    return jsonOk(await listSalaryStructures(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPayrollAuth(request, payrollPermissions.salaryStructureWrite, async (ctx) => {
    const payload = await parseJson(request, salaryStructureCreateSchema);
    return jsonOk(await createSalaryStructure(ctx, payload), { status: 201 });
  });
}
