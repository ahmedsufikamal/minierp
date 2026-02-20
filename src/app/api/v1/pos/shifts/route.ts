import { createPosShift, listPosShifts } from "@/modules/pos/application/shifts.service";
import { posShiftCreateSchema, posShiftListQuerySchema } from "@/modules/pos/domain/schemas";
import { posPermissions } from "@/modules/pos/domain/types";
import { jsonOk, parseJson, parseQuery, withPosAuth } from "@/modules/pos/interface/http";

export async function GET(request: Request) {
  return withPosAuth(request, posPermissions.shiftRead, async (ctx) => {
    const query = parseQuery(request, posShiftListQuerySchema);
    return jsonOk(await listPosShifts(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPosAuth(request, posPermissions.shiftWrite, async (ctx) => {
    const payload = await parseJson(request, posShiftCreateSchema);
    return jsonOk(await createPosShift(ctx, payload), { status: 201 });
  });
}
