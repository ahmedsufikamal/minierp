import {
  createAccountingPeriod,
  listAccountingPeriods,
  updateAccountingPeriodStatus,
} from "@/modules/accounting/application/fiscal-period.service";
import { periodCreateSchema, periodListQuerySchema, periodUpdateSchema } from "@/modules/accounting/domain/schemas";
import { accountingPermissions } from "@/modules/accounting/domain/types";
import { jsonOk, parseJson, parseQuery, withAccountingAuth } from "@/modules/accounting/interface/http";

export async function GET(request: Request) {
  return withAccountingAuth(request, accountingPermissions.periodRead, async (ctx) => {
    const query = parseQuery(request, periodListQuerySchema);
    return jsonOk(await listAccountingPeriods(ctx, query));
  });
}

export async function POST(request: Request) {
  return withAccountingAuth(request, accountingPermissions.periodWrite, async (ctx) => {
    const payload = await parseJson(request, periodCreateSchema);
    return jsonOk(await createAccountingPeriod(ctx, payload), { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return withAccountingAuth(request, accountingPermissions.periodWrite, async (ctx) => {
    const payload = await parseJson(request, periodUpdateSchema);
    return jsonOk(await updateAccountingPeriodStatus(ctx, payload));
  });
}
