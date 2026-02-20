import { listGLEntries } from "@/modules/accounting/application/gl-posting.service";
import { glQuerySchema } from "@/modules/accounting/domain/schemas";
import { accountingPermissions } from "@/modules/accounting/domain/types";
import { jsonOk, parseQuery, withAccountingAuth } from "@/modules/accounting/interface/http";

export async function GET(request: Request) {
  return withAccountingAuth(request, accountingPermissions.glRead, async (ctx) => {
    const query = parseQuery(request, glQuerySchema);
    return jsonOk(await listGLEntries(ctx, query));
  });
}
