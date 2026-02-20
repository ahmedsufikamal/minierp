import { createApiToken, listApiTokens } from "@/modules/integrations/application/tokens.service";
import {
  apiTokenCreateSchema,
  apiTokenListQuerySchema,
} from "@/modules/integrations/domain/schemas";
import { integrationsPermissions } from "@/modules/integrations/domain/types";
import {
  jsonOk,
  parseJson,
  parseQuery,
  withIntegrationsAuth,
} from "@/modules/integrations/interface/http";

export async function GET(request: Request) {
  return withIntegrationsAuth(request, integrationsPermissions.tokenRead, async (ctx) => {
    const query = parseQuery(request, apiTokenListQuerySchema);
    return jsonOk(await listApiTokens(ctx, query));
  });
}

export async function POST(request: Request) {
  return withIntegrationsAuth(request, integrationsPermissions.tokenWrite, async (ctx) => {
    const payload = await parseJson(request, apiTokenCreateSchema);
    return jsonOk(await createApiToken(ctx, payload), { status: 201 });
  });
}
