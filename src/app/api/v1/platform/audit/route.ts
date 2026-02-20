import { listAuditEvents } from "@/modules/platform/application/audit-ledger.service";
import { auditQuerySchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.auditRead, async (ctx) => {
    const query = parseQuery(request, auditQuerySchema);
    return jsonOk(await listAuditEvents(ctx, query));
  });
}
