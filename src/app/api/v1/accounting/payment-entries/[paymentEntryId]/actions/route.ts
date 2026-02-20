import { applyPaymentEntryAction } from "@/modules/accounting/application/payment-entries.service";
import { paymentEntryActionSchema } from "@/modules/accounting/domain/schemas";
import { accountingPermissions } from "@/modules/accounting/domain/types";
import { jsonOk, parseJson, withAccountingAuth } from "@/modules/accounting/interface/http";

type Params = {
  params: Promise<{ paymentEntryId: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withAccountingAuth(request, accountingPermissions.paymentEntrySubmit, async (ctx) => {
    const { paymentEntryId } = await params;
    const payload = await parseJson(request, paymentEntryActionSchema.omit({ paymentEntryId: true }));
    return jsonOk(
      await applyPaymentEntryAction(ctx, {
        paymentEntryId,
        ...payload,
      }),
    );
  });
}
