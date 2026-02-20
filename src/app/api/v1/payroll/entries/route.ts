import { createPayrollEntry, listPayrollEntries } from "@/modules/payroll/application/payroll-entries.service";
import { payrollEntryCreateSchema, payrollEntryListQuerySchema } from "@/modules/payroll/domain/schemas";
import { payrollPermissions } from "@/modules/payroll/domain/types";
import { jsonOk, parseJson, parseQuery, withPayrollAuth } from "@/modules/payroll/interface/http";

export async function GET(request: Request) {
  return withPayrollAuth(request, payrollPermissions.payrollEntryRead, async (ctx) => {
    const query = parseQuery(request, payrollEntryListQuerySchema);
    return jsonOk(await listPayrollEntries(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPayrollAuth(request, payrollPermissions.payrollEntryWrite, async (ctx) => {
    const payload = await parseJson(request, payrollEntryCreateSchema);
    return jsonOk(await createPayrollEntry(ctx, payload), { status: 201 });
  });
}
