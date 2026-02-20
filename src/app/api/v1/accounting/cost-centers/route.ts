import {
  createCostCenter,
  listCostCenters,
} from "@/modules/accounting/application/accounting-masters.service";
import {
  costCenterCreateSchema,
  costCenterListQuerySchema,
} from "@/modules/accounting/domain/schemas";
import { accountingPermissions } from "@/modules/accounting/domain/types";
import { jsonOk, parseJson, parseQuery, withAccountingAuth } from "@/modules/accounting/interface/http";

export async function GET(request: Request) {
  return withAccountingAuth(request, accountingPermissions.costCenterRead, async (ctx) => {
    const query = parseQuery(request, costCenterListQuerySchema);
    return jsonOk(await listCostCenters(ctx, query));
  });
}

export async function POST(request: Request) {
  return withAccountingAuth(request, accountingPermissions.costCenterWrite, async (ctx) => {
    const payload = await parseJson(request, costCenterCreateSchema);
    return jsonOk(await createCostCenter(ctx, payload), { status: 201 });
  });
}
