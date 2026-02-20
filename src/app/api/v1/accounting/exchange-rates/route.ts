import {
  createExchangeRate,
  listExchangeRates,
} from "@/modules/accounting/application/accounting-masters.service";
import {
  exchangeRateCreateSchema,
  exchangeRateListQuerySchema,
} from "@/modules/accounting/domain/schemas";
import { accountingPermissions } from "@/modules/accounting/domain/types";
import { jsonOk, parseJson, parseQuery, withAccountingAuth } from "@/modules/accounting/interface/http";

export async function GET(request: Request) {
  return withAccountingAuth(request, accountingPermissions.exchangeRateRead, async (ctx) => {
    const query = parseQuery(request, exchangeRateListQuerySchema);
    return jsonOk(await listExchangeRates(ctx, query));
  });
}

export async function POST(request: Request) {
  return withAccountingAuth(request, accountingPermissions.exchangeRateWrite, async (ctx) => {
    const payload = await parseJson(request, exchangeRateCreateSchema);
    return jsonOk(await createExchangeRate(ctx, payload), { status: 201 });
  });
}
