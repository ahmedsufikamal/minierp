import { createAttachmentUpload } from "@/modules/inventory/application/attachments.service";
import { attachmentCreateSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.attachmentWrite, async (ctx) => {
    const payload = await parseJson(request, attachmentCreateSchema);
    return jsonOk(await createAttachmentUpload(ctx, payload), { status: 201 });
  });
}
