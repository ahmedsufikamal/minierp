import { applyInventoryReconciliation } from "@/modules/inventory/application/reconciliation.service";
import { reconciliationApplySchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { assertInventoryRateLimit } from "@/modules/inventory/infrastructure/rate-limit";
import {
  jsonOk,
  parseJson,
  requireIdempotencyKeyHeader,
  withInventoryAuth,
} from "@/modules/inventory/interface/http";

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.documentWrite, async (ctx) => {
    const payload = await parseJson(request, reconciliationApplySchema);
    const idempotencyKey = requireIdempotencyKeyHeader(request);

    await assertInventoryRateLimit({
      key: `${ctx.companyId}:${ctx.userId}:${ctx.ipAddress ?? "unknown"}:reconciliation-apply`,
      scope: "inventory:reconciliation-apply",
      maxAttempts: 30,
      windowSeconds: 60,
    });

    return jsonOk(await applyInventoryReconciliation(ctx, payload, { idempotencyKey }), {
      status: 201,
    });
  });
}
