import { createAttendance, listAttendance } from "@/modules/hr/application/attendance.service";
import { attendanceCreateSchema, attendanceListQuerySchema } from "@/modules/hr/domain/schemas";
import { hrPermissions } from "@/modules/hr/domain/types";
import { jsonOk, parseJson, parseQuery, withHrAuth } from "@/modules/hr/interface/http";

export async function GET(request: Request) {
  return withHrAuth(request, hrPermissions.attendanceRead, async (ctx) => {
    const query = parseQuery(request, attendanceListQuerySchema);
    return jsonOk(await listAttendance(ctx, query));
  });
}

export async function POST(request: Request) {
  return withHrAuth(request, hrPermissions.attendanceWrite, async (ctx) => {
    const payload = await parseJson(request, attendanceCreateSchema);
    return jsonOk(await createAttendance(ctx, payload), { status: 201 });
  });
}
