import {
  createSupplierPayment,
  listSupplierPayments,
} from "@/modules/buying/application/payables.service";
import {
  supplierPaymentCreateSchema,
  supplierPaymentListQuerySchema,
} from "@/modules/buying/domain/schemas";
import { buyingPermissions } from "@/modules/buying/domain/types";
import { jsonOk, parseJson, parseQuery, withBuyingAuth } from "@/modules/buying/interface/http";

export async function GET(request: Request) {
  return withBuyingAuth(request, buyingPermissions.supplierPaymentRead, async (ctx) => {
    const query = parseQuery(request, supplierPaymentListQuerySchema);
    return jsonOk(await listSupplierPayments(ctx, query));
  });
}

export async function POST(request: Request) {
  return withBuyingAuth(request, buyingPermissions.supplierPaymentWrite, async (ctx) => {
    const payload = await parseJson(request, supplierPaymentCreateSchema);
    return jsonOk(await createSupplierPayment(ctx, payload), { status: 201 });
  });
}
