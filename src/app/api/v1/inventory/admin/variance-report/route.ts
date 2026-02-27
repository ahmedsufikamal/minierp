import { generateInventoryVarianceReport } from "@/modules/inventory/application/admin-ops.service";
import { varianceReportRequestSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.adminOps, async (ctx) => {
    const payload = await parseJson(request, varianceReportRequestSchema);
    return jsonOk(await generateInventoryVarianceReport(ctx, payload));
  });
}

