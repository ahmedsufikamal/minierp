import { createExportJob, listExportJobs } from "@/modules/inventory/application/import-export.service";
import { exportJobSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.exportRead, async (ctx) => {
    return jsonOk(await listExportJobs(ctx));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.exportWrite, async (ctx) => {
    const payload = await parseJson(request, exportJobSchema);
    return jsonOk(await createExportJob(ctx, payload), { status: 201 });
  });
}
