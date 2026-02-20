import { getReceivablesAging } from "@/modules/selling/application/receivables.service";
import { receivablesAgingQuerySchema } from "@/modules/selling/domain/schemas";
import { sellingPermissions } from "@/modules/selling/domain/types";
import { jsonOk, parseQuery, withSellingAuth } from "@/modules/selling/interface/http";

export async function GET(request: Request) {
  return withSellingAuth(request, sellingPermissions.receivableRead, async (ctx) => {
    const query = parseQuery(request, receivablesAgingQuerySchema);
    return jsonOk(await getReceivablesAging(ctx, query));
  });
}
