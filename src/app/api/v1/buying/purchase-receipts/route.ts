import {
  createPurchaseReceipt,
  listPurchaseReceipts,
} from "@/modules/buying/application/purchase-receipts.service";
import {
  purchaseReceiptCreateSchema,
  purchaseReceiptListQuerySchema,
} from "@/modules/buying/domain/schemas";
import { buyingPermissions } from "@/modules/buying/domain/types";
import { jsonOk, parseJson, parseQuery, withBuyingAuth } from "@/modules/buying/interface/http";

export async function GET(request: Request) {
  return withBuyingAuth(request, buyingPermissions.purchaseReceiptRead, async (ctx) => {
    const query = parseQuery(request, purchaseReceiptListQuerySchema);
    return jsonOk(await listPurchaseReceipts(ctx, query));
  });
}

export async function POST(request: Request) {
  return withBuyingAuth(request, buyingPermissions.purchaseReceiptWrite, async (ctx) => {
    const payload = await parseJson(request, purchaseReceiptCreateSchema);
    return jsonOk(await createPurchaseReceipt(ctx, payload), { status: 201 });
  });
}
