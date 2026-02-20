import {
  enqueueEmail,
  listEmailQueue,
} from "@/modules/integrations/application/email-queue.service";
import {
  emailQueueCreateSchema,
  emailQueueListQuerySchema,
} from "@/modules/integrations/domain/schemas";
import { integrationsPermissions } from "@/modules/integrations/domain/types";
import {
  jsonOk,
  parseJson,
  parseQuery,
  withIntegrationsAuth,
} from "@/modules/integrations/interface/http";

export async function GET(request: Request) {
  return withIntegrationsAuth(request, integrationsPermissions.emailQueueRead, async (ctx) => {
    const query = parseQuery(request, emailQueueListQuerySchema);
    return jsonOk(await listEmailQueue(ctx, query));
  });
}

export async function POST(request: Request) {
  return withIntegrationsAuth(request, integrationsPermissions.emailQueueWrite, async (ctx) => {
    const payload = await parseJson(request, emailQueueCreateSchema);
    return jsonOk(await enqueueEmail(ctx, payload), { status: 201 });
  });
}
