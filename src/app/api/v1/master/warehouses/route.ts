import { listMasterWarehouses } from "@/modules/platform/application/master-reference.service";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.masterRead, async (ctx) => {
    return jsonOk(await listMasterWarehouses(ctx));
  });
}
