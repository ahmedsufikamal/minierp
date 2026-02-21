import { previewCompanyNumberingPattern } from "@/modules/platform/application/company-numbering.service";
import { companyNumberingPreviewSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.numberingRead, async (ctx) => {
    const payload = await parseJson(request, companyNumberingPreviewSchema);
    return jsonOk(await previewCompanyNumberingPattern(ctx, payload));
  });
}
