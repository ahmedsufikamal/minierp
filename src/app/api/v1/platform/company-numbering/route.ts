import {
  listCompanyNumberingMasterConfig,
  updateCompanyNumberingMasterConfig,
} from "@/modules/platform/application/company-numbering.service";
import { companyNumberingPatchSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.numberingRead, async (ctx) => {
    return jsonOk(await listCompanyNumberingMasterConfig(ctx));
  });
}

export async function PATCH(request: Request) {
  return withPlatformAuth(request, platformPermissions.numberingWrite, async (ctx) => {
    const payload = await parseJson(request, companyNumberingPatchSchema);
    return jsonOk(await updateCompanyNumberingMasterConfig(ctx, payload));
  });
}
