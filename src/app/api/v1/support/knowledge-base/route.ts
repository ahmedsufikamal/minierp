import {
  createKnowledgeArticle,
  listKnowledgeArticles,
} from "@/modules/support/application/knowledge-base.service";
import {
  knowledgeArticleCreateSchema,
  knowledgeArticleListQuerySchema,
} from "@/modules/support/domain/schemas";
import { supportPermissions } from "@/modules/support/domain/types";
import { jsonOk, parseJson, parseQuery, withSupportAuth } from "@/modules/support/interface/http";

export async function GET(request: Request) {
  return withSupportAuth(request, supportPermissions.knowledgeBaseRead, async (ctx) => {
    const query = parseQuery(request, knowledgeArticleListQuerySchema);
    return jsonOk(await listKnowledgeArticles(ctx, query));
  });
}

export async function POST(request: Request) {
  return withSupportAuth(request, supportPermissions.knowledgeBaseWrite, async (ctx) => {
    const payload = await parseJson(request, knowledgeArticleCreateSchema);
    return jsonOk(await createKnowledgeArticle(ctx, payload), { status: 201 });
  });
}
