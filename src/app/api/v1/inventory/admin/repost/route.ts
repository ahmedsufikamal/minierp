import { enqueueInventoryRepostJob } from "@/modules/inventory/application/admin-ops.service";
import { repostRequestSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { assertInventoryRateLimit } from "@/modules/inventory/infrastructure/rate-limit";
import {
  jsonOk,
  parseJson,
  requireIdempotencyKeyHeader,
  withInventoryAuth,
} from "@/modules/inventory/interface/http";

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.adminOps, async (ctx) => {
    const payload = await parseJson(request, repostRequestSchema);
    const idempotencyKey = requireIdempotencyKeyHeader(request);

    await assertInventoryRateLimit({
      key: `${ctx.companyId}:${ctx.userId}:${ctx.ipAddress ?? "unknown"}:admin-repost`,
      scope: "inventory:admin:repost",
      maxAttempts: 10,
      windowSeconds: 60,
    });

    return jsonOk(await enqueueInventoryRepostJob(ctx, payload, { idempotencyKey }), {
      status: 202,
    });
  });
}

