import { createEmployee, listEmployees } from "@/modules/hr/application/employees.service";
import { employeeCreateSchema, employeeListQuerySchema } from "@/modules/hr/domain/schemas";
import { hrPermissions } from "@/modules/hr/domain/types";
import { jsonOk, parseJson, parseQuery, withHrAuth } from "@/modules/hr/interface/http";

export async function GET(request: Request) {
  return withHrAuth(request, hrPermissions.employeeRead, async (ctx) => {
    const query = parseQuery(request, employeeListQuerySchema);
    return jsonOk(await listEmployees(ctx, query));
  });
}

export async function POST(request: Request) {
  return withHrAuth(request, hrPermissions.employeeWrite, async (ctx) => {
    const payload = await parseJson(request, employeeCreateSchema);
    return jsonOk(await createEmployee(ctx, payload), { status: 201 });
  });
}
