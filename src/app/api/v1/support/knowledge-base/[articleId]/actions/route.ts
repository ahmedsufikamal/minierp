import { applyKnowledgeArticleAction } from "@/modules/support/application/knowledge-base.service";
import { knowledgeArticleActionSchema } from "@/modules/support/domain/schemas";
import { supportPermissions } from "@/modules/support/domain/types";
import { jsonOk, parseJson, withSupportAuth } from "@/modules/support/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ articleId: string }> },
) {
  return withSupportAuth(request, supportPermissions.knowledgeBaseManage, async (ctx) => {
    const { articleId } = await context.params;
    const payload = await parseJson(request, knowledgeArticleActionSchema);
    return jsonOk(await applyKnowledgeArticleAction(ctx, articleId, payload));
  });
}
