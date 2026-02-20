import { createAccount, listAccounts } from "@/modules/accounting/application/accounts.service";
import { accountCreateSchema } from "@/modules/accounting/domain/schemas";
import { accountingPermissions } from "@/modules/accounting/domain/types";
import { jsonOk, parseJson, withAccountingAuth } from "@/modules/accounting/interface/http";

export async function GET(request: Request) {
  return withAccountingAuth(request, accountingPermissions.accountRead, async (ctx) => {
    return jsonOk(await listAccounts(ctx));
  });
}

export async function POST(request: Request) {
  return withAccountingAuth(request, accountingPermissions.accountWrite, async (ctx) => {
    const payload = await parseJson(request, accountCreateSchema);
    return jsonOk(await createAccount(ctx, payload), { status: 201 });
  });
}
