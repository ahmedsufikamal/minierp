import {
  createSupplierQuotation,
  listSupplierQuotations,
} from "@/modules/buying/application/supplier-quotations.service";
import {
  supplierQuotationCreateSchema,
  supplierQuotationListQuerySchema,
} from "@/modules/buying/domain/schemas";
import { buyingPermissions } from "@/modules/buying/domain/types";
import { jsonOk, parseJson, parseQuery, withBuyingAuth } from "@/modules/buying/interface/http";

export async function GET(request: Request) {
  return withBuyingAuth(request, buyingPermissions.supplierQuotationRead, async (ctx) => {
    const query = parseQuery(request, supplierQuotationListQuerySchema);
    return jsonOk(await listSupplierQuotations(ctx, query));
  });
}

export async function POST(request: Request) {
  return withBuyingAuth(request, buyingPermissions.supplierQuotationWrite, async (ctx) => {
    const payload = await parseJson(request, supplierQuotationCreateSchema);
    return jsonOk(await createSupplierQuotation(ctx, payload), { status: 201 });
  });
}
