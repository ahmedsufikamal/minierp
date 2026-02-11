import { getAttachmentDownload } from "@/modules/inventory/application/attachments.service";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request, props: { params: Promise<{ attachmentId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.attachmentRead, async (ctx) => {
    const { attachmentId } = await props.params;
    return jsonOk(await getAttachmentDownload(ctx, attachmentId));
  });
}
