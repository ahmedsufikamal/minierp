import { createExpenseClaim, listExpenseClaims } from "@/modules/hr/application/expense-claims.service";
import { expenseClaimCreateSchema, expenseClaimListQuerySchema } from "@/modules/hr/domain/schemas";
import { hrPermissions } from "@/modules/hr/domain/types";
import { jsonOk, parseJson, parseQuery, withHrAuth } from "@/modules/hr/interface/http";

export async function GET(request: Request) {
  return withHrAuth(request, hrPermissions.expenseRead, async (ctx) => {
    const query = parseQuery(request, expenseClaimListQuerySchema);
    return jsonOk(await listExpenseClaims(ctx, query));
  });
}

export async function POST(request: Request) {
  return withHrAuth(request, hrPermissions.expenseWrite, async (ctx) => {
    const payload = await parseJson(request, expenseClaimCreateSchema);
    return jsonOk(await createExpenseClaim(ctx, payload), { status: 201 });
  });
}
