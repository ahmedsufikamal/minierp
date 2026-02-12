import { commitImportJob } from "@/modules/inventory/application/import-export.service";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";
import { z } from "zod";

const commitSchema = z.object({
  payload: z.string().min(1, "payload is required for commit"),
});

export async function POST(request: Request, props: { params: Promise<{ jobId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.importWrite, async (ctx) => {
    const { jobId } = await props.params;
    const body = await parseJson(request, commitSchema);
    return jsonOk(await commitImportJob(ctx, { jobId, payload: body.payload }));
  });
}
