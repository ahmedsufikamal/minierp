import { getTradeLcReport } from "@/modules/trade/application/lc-reports.service";
import { lcReportQuerySchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { toCsv } from "@/modules/trade/application/lc-csv";
import { jsonCsv, jsonOk, parseQuery, withTradeAuth } from "@/modules/trade/interface/http";

export async function GET(request: Request) {
  return withTradeAuth(request, tradePermissions.lcRead, async (ctx) => {
    const query = parseQuery(request, lcReportQuerySchema);
    const rows = await getTradeLcReport(ctx, "outstanding", query);
    return query.format === "csv"
      ? jsonCsv(toCsv(rows), "trade-lc-outstanding.csv")
      : jsonOk(rows);
  });
}
