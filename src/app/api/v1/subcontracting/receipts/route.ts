import { createSubcontractingReceipt, listSubcontractingReceipts } from "@/modules/subcontracting/application/receipts.service";
import {
  subcontractingReceiptCreateSchema,
  subcontractingReceiptListQuerySchema,
} from "@/modules/subcontracting/domain/schemas";
import { subcontractingPermissions } from "@/modules/subcontracting/domain/types";
import { jsonOk, parseJson, parseQuery, withSubcontractingAuth } from "@/modules/subcontracting/interface/http";

export async function GET(request: Request) {
  return withSubcontractingAuth(request, subcontractingPermissions.receiptRead, async (ctx) => {
    const query = parseQuery(request, subcontractingReceiptListQuerySchema);
    return jsonOk(await listSubcontractingReceipts(ctx, query));
  });
}

export async function POST(request: Request) {
  return withSubcontractingAuth(request, subcontractingPermissions.receiptWrite, async (ctx) => {
    const payload = await parseJson(request, subcontractingReceiptCreateSchema);
    return jsonOk(await createSubcontractingReceipt(ctx, payload), { status: 201 });
  });
}
