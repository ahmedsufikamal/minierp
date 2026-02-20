import { createSupportQueue, listSupportQueues } from "@/modules/support/application/queues.service";
import { supportQueueCreateSchema, supportQueueListQuerySchema } from "@/modules/support/domain/schemas";
import { supportPermissions } from "@/modules/support/domain/types";
import { jsonOk, parseJson, parseQuery, withSupportAuth } from "@/modules/support/interface/http";

export async function GET(request: Request) {
  return withSupportAuth(request, supportPermissions.queueRead, async (ctx) => {
    const query = parseQuery(request, supportQueueListQuerySchema);
    return jsonOk(await listSupportQueues(ctx, query));
  });
}

export async function POST(request: Request) {
  return withSupportAuth(request, supportPermissions.queueWrite, async (ctx) => {
    const payload = await parseJson(request, supportQueueCreateSchema);
    return jsonOk(await createSupportQueue(ctx, payload), { status: 201 });
  });
}
