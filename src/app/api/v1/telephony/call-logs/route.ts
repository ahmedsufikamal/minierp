import { createCallLog, listCallLogs } from "@/modules/telephony/application/call-logs.service";
import { callLogCreateSchema, callLogListQuerySchema } from "@/modules/telephony/domain/schemas";
import { telephonyPermissions } from "@/modules/telephony/domain/types";
import { jsonOk, parseJson, parseQuery, withTelephonyAuth } from "@/modules/telephony/interface/http";

export async function GET(request: Request) {
  return withTelephonyAuth(request, telephonyPermissions.callRead, async (ctx) => {
    const query = parseQuery(request, callLogListQuerySchema);
    return jsonOk(await listCallLogs(ctx, query));
  });
}

export async function POST(request: Request) {
  return withTelephonyAuth(request, telephonyPermissions.callWrite, async (ctx) => {
    const payload = await parseJson(request, callLogCreateSchema);
    return jsonOk(await createCallLog(ctx, payload), { status: 201 });
  });
}
