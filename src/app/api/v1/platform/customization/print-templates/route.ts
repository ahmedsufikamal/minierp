import { upsertPrintTemplate } from "@/modules/platform/application/customization.service";
import { platformPermissions } from "@/modules/platform/domain/types";
import { printTemplateSchema } from "@/modules/platform/domain/schemas";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, printTemplateSchema);
    return jsonOk(await upsertPrintTemplate(ctx, payload), { status: 201 });
  });
}
