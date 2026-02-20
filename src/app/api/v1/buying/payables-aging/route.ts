import { getPayablesAging } from "@/modules/buying/application/payables.service";
import { payablesAgingQuerySchema } from "@/modules/buying/domain/schemas";
import { buyingPermissions } from "@/modules/buying/domain/types";
import { jsonOk, parseQuery, withBuyingAuth } from "@/modules/buying/interface/http";

export async function GET(request: Request) {
  return withBuyingAuth(request, buyingPermissions.payableRead, async (ctx) => {
    const query = parseQuery(request, payablesAgingQuerySchema);
    return jsonOk(await getPayablesAging(ctx, query));
  });
}
