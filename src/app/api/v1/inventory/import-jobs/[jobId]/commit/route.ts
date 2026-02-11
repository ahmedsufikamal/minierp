import { commitImportJob } from "@/modules/inventory/application/import-export.service";
import { InventoryError } from "@/modules/inventory/domain/errors";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function POST(request: Request, props: { params: Promise<{ jobId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.importWrite, async (ctx) => {
    const { jobId } = await props.params;
    const body = (await request.json().catch(() => ({}))) as { payload?: string };
    if (!body.payload) {
      throw new InventoryError("VALIDATION_ERROR", "payload is required for commit");
    }
    return jsonOk(await commitImportJob(ctx, { jobId, payload: body.payload }));
  });
}
