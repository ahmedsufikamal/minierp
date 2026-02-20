import {
  createEmailTemplate,
  listEmailTemplates,
} from "@/modules/integrations/application/templates.service";
import {
  emailTemplateCreateSchema,
  emailTemplateListQuerySchema,
} from "@/modules/integrations/domain/schemas";
import { integrationsPermissions } from "@/modules/integrations/domain/types";
import {
  jsonOk,
  parseJson,
  parseQuery,
  withIntegrationsAuth,
} from "@/modules/integrations/interface/http";

export async function GET(request: Request) {
  return withIntegrationsAuth(request, integrationsPermissions.templateRead, async (ctx) => {
    const query = parseQuery(request, emailTemplateListQuerySchema);
    return jsonOk(await listEmailTemplates(ctx, query));
  });
}

export async function POST(request: Request) {
  return withIntegrationsAuth(request, integrationsPermissions.templateWrite, async (ctx) => {
    const payload = await parseJson(request, emailTemplateCreateSchema);
    return jsonOk(await createEmailTemplate(ctx, payload), { status: 201 });
  });
}
