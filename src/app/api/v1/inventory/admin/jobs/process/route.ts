import { NextResponse } from "next/server";
import { processInventoryOpsJobById } from "@/modules/inventory/application/admin-ops.service";

export async function POST(request: Request) {
  const expected = process.env.INVENTORY_WORKER_TOKEN?.trim();
  const provided = request.headers.get("x-inventory-worker-token")?.trim();

  if (!expected || !provided || provided !== expected) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Invalid inventory worker token" },
      },
      { status: 401 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as { jobId?: string; companyId?: string };
  if (!payload.jobId || !payload.companyId) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "jobId and companyId are required" },
      },
      { status: 400 },
    );
  }

  const job = await processInventoryOpsJobById(payload.jobId, payload.companyId);
  return NextResponse.json({ ok: true, data: job });
}
