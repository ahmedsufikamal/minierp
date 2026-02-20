import {
  applyPaymentEntryAction,
  createPaymentEntry,
  listPaymentEntries,
} from "@/modules/accounting/application/payment-entries.service";
import {
  paymentEntryActionSchema,
  paymentEntryCreateSchema,
  paymentEntryListQuerySchema,
} from "@/modules/accounting/domain/schemas";
import { accountingPermissions } from "@/modules/accounting/domain/types";
import { jsonOk, parseJson, parseQuery, withAccountingAuth } from "@/modules/accounting/interface/http";

export async function GET(request: Request) {
  return withAccountingAuth(request, accountingPermissions.paymentEntryRead, async (ctx) => {
    const query = parseQuery(request, paymentEntryListQuerySchema);
    return jsonOk(await listPaymentEntries(ctx, query));
  });
}

export async function POST(request: Request) {
  return withAccountingAuth(request, accountingPermissions.paymentEntryWrite, async (ctx) => {
    const payload = await parseJson(request, paymentEntryCreateSchema);
    return jsonOk(await createPaymentEntry(ctx, payload), { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return withAccountingAuth(request, accountingPermissions.paymentEntrySubmit, async (ctx) => {
    const payload = await parseJson(request, paymentEntryActionSchema);
    return jsonOk(await applyPaymentEntryAction(ctx, payload));
  });
}
