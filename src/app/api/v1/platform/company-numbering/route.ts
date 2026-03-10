import {
  listCompanyNumberingMasterConfig,
  saveCompanyCodeSettings,
  updateCompanyNumberingMasterConfig,
} from "@/modules/platform/application/company-numbering.service";
import { PlatformError } from "@/modules/platform/domain/errors";
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
    if (payload.action === "RESET" || payload.settings) {
      return jsonOk(await saveCompanyCodeSettings(ctx, payload));
    }
    if (!payload.formats?.length) {
      throw new PlatformError("VALIDATION_ERROR", "Expected legacy company numbering formats payload.");
    }
    return jsonOk(await updateCompanyNumberingMasterConfig(ctx, { formats: payload.formats }));
  });
}
