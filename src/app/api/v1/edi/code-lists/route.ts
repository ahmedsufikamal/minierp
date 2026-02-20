import { createEdiCodeList, listEdiCodeLists } from "@/modules/edi/application/code-lists.service";
import { ediCodeListCreateSchema, ediCodeListQuerySchema } from "@/modules/edi/domain/schemas";
import { ediPermissions } from "@/modules/edi/domain/types";
import { jsonOk, parseJson, parseQuery, withEdiAuth } from "@/modules/edi/interface/http";

export async function GET(request: Request) {
  return withEdiAuth(request, ediPermissions.codeRead, async (ctx) => {
    const query = parseQuery(request, ediCodeListQuerySchema);
    return jsonOk(await listEdiCodeLists(ctx, query));
  });
}

export async function POST(request: Request) {
  return withEdiAuth(request, ediPermissions.codeWrite, async (ctx) => {
    const payload = await parseJson(request, ediCodeListCreateSchema);
    return jsonOk(await createEdiCodeList(ctx, payload), { status: 201 });
  });
}
