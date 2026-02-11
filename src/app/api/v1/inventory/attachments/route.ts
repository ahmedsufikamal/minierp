import { InventoryAttachmentEntityType } from "@prisma/client";
import { listAttachmentsForEntity } from "@/modules/inventory/application/attachments.service";
import { InventoryError } from "@/modules/inventory/domain/errors";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.attachmentRead, async (ctx) => {
    const params = new URL(request.url).searchParams;
    const entityId = params.get("entityId") || "";
    const entityType = params.get("entityType") || "";

    if (!entityId || !entityType || !(entityType in InventoryAttachmentEntityType)) {
      throw new InventoryError("VALIDATION_ERROR", "entityType and entityId are required");
    }

    return jsonOk(
      await listAttachmentsForEntity(ctx, {
        entityType: entityType as "ITEM" | "DOCUMENT",
        entityId,
      }),
    );
  });
}
