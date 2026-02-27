import { applyInventoryDocumentAction } from "@/modules/inventory/application/documents.service";
import { documentActionSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { assertInventoryRateLimit } from "@/modules/inventory/infrastructure/rate-limit";
import {
  jsonOk,
  parseJson,
  requireIdempotencyKeyHeader,
  withInventoryAuth,
} from "@/modules/inventory/interface/http";

export async function POST(request: Request, props: { params: Promise<{ docId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.documentWrite, async (ctx) => {
    const { docId } = await props.params;
    const payload = await parseJson(request, documentActionSchema);
    const idempotencyKey =
      payload.action === "POST" ? requireIdempotencyKeyHeader(request) : payload.idempotencyKey;

    if (payload.action === "POST") {
      await assertInventoryRateLimit({
        key: `${ctx.companyId}:${ctx.userId}:${ctx.ipAddress ?? "unknown"}:document-post`,
        scope: "inventory:document-post",
        maxAttempts: 60,
        windowSeconds: 60,
      });
    }

    return jsonOk(
      await applyInventoryDocumentAction(ctx, docId, {
        ...payload,
        idempotencyKey,
      }),
    );
  });
}
