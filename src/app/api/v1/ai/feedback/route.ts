import { submitAiFeedback } from "@/modules/platform/application/ops-ai.service";
import { aiFeedbackSchema } from "@/modules/platform/domain/ops-ai.schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import {
  jsonOk,
  parseJson,
  requireIdempotencyKeyHeader,
  withPlatformAuth,
} from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.reportingWrite, async (ctx) => {
    const payload = await parseJson(request, aiFeedbackSchema);
    // Feedback events are write operations and must be idempotent from clients.
    requireIdempotencyKeyHeader(request);
    return jsonOk(await submitAiFeedback(ctx, payload), { status: 201 });
  });
}
