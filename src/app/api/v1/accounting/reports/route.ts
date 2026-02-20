import { runAccountingReport } from "@/modules/accounting/application/reporting.service";
import { accountingReportQuerySchema } from "@/modules/accounting/domain/schemas";
import { accountingPermissions } from "@/modules/accounting/domain/types";
import { jsonOk, parseQuery, withAccountingAuth } from "@/modules/accounting/interface/http";

export async function GET(request: Request) {
  return withAccountingAuth(request, accountingPermissions.reportRead, async (ctx) => {
    const query = parseQuery(request, accountingReportQuerySchema);
    return jsonOk(await runAccountingReport(ctx, query));
  });
}
