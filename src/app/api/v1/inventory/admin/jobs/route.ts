import { z } from "zod";
import {
  listInventoryOpsJobs,
  listLatestStockClosing,
} from "@/modules/inventory/application/admin-ops.service";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseQuery, withInventoryAuth } from "@/modules/inventory/interface/http";

const querySchema = z.object({
  status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
  take: z.coerce.number().int().positive().max(500).default(100),
});

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.adminOps, async (ctx) => {
    const query = parseQuery(request, querySchema);
    const [jobs, closings] = await Promise.all([
      listInventoryOpsJobs(ctx, { status: query.status, take: query.take }),
      listLatestStockClosing(ctx, { take: Math.min(query.take, 50) }),
    ]);
    return jsonOk({ jobs, closings });
  });
}

