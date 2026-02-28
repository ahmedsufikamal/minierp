import { updateMasterItem } from "@/modules/platform/application/master-item.service";
import { masterItemUpsertSchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPlatformAuth(request, platformPermissions.masterWrite, async (ctx) => {
    const { id } = await context.params;
    const payload = await parseJson(request, masterItemUpsertSchema.partial());
    return jsonOk(await updateMasterItem(ctx, id, payload));
  });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}
