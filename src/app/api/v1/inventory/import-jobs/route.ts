import { createImportJob, listImportJobs } from "@/modules/inventory/application/import-export.service";
import { importJobSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.importRead, async (ctx) => {
    return jsonOk(await listImportJobs(ctx));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.importWrite, async (ctx) => {
    const payload = await parseJson(request, importJobSchema);
    return jsonOk(await createImportJob(ctx, payload), { status: 201 });
  });
}
