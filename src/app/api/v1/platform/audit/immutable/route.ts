import { verifyImmutableLedgerChain } from "@/modules/platform/application/audit-ledger.service";
import { immutableVerifySchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.ledgerRead, async (ctx) => {
    const query = parseQuery(request, immutableVerifySchema);
    return jsonOk(await verifyImmutableLedgerChain(ctx, query));
  });
}
