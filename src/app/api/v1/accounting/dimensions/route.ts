import {
  createAccountingDimension,
  listAccountingDimensions,
} from "@/modules/accounting/application/accounting-masters.service";
import {
  accountingDimensionCreateSchema,
  accountingDimensionListQuerySchema,
} from "@/modules/accounting/domain/schemas";
import { accountingPermissions } from "@/modules/accounting/domain/types";
import { jsonOk, parseJson, parseQuery, withAccountingAuth } from "@/modules/accounting/interface/http";

export async function GET(request: Request) {
  return withAccountingAuth(request, accountingPermissions.dimensionRead, async (ctx) => {
    const query = parseQuery(request, accountingDimensionListQuerySchema);
    return jsonOk(await listAccountingDimensions(ctx, query));
  });
}

export async function POST(request: Request) {
  return withAccountingAuth(request, accountingPermissions.dimensionWrite, async (ctx) => {
    const payload = await parseJson(request, accountingDimensionCreateSchema);
    return jsonOk(await createAccountingDimension(ctx, payload), { status: 201 });
  });
}
