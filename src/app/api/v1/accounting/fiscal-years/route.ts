import { createFiscalYear, listFiscalYears } from "@/modules/accounting/application/fiscal-period.service";
import { fiscalYearCreateSchema } from "@/modules/accounting/domain/schemas";
import { accountingPermissions } from "@/modules/accounting/domain/types";
import { jsonOk, parseJson, withAccountingAuth } from "@/modules/accounting/interface/http";

export async function GET(request: Request) {
  return withAccountingAuth(request, accountingPermissions.periodRead, async (ctx) => {
    return jsonOk(await listFiscalYears(ctx));
  });
}

export async function POST(request: Request) {
  return withAccountingAuth(request, accountingPermissions.periodWrite, async (ctx) => {
    const payload = await parseJson(request, fiscalYearCreateSchema);
    return jsonOk(await createFiscalYear(ctx, payload), { status: 201 });
  });
}
