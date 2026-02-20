import { listNumberSeries, upsertNumberSeries } from "@/modules/platform/application/numbering.service";
import { numberSeriesSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.numberingRead, async (ctx) => {
    return jsonOk(await listNumberSeries(ctx));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.numberingWrite, async (ctx) => {
    const payload = await parseJson(request, numberSeriesSchema);
    return jsonOk(await upsertNumberSeries(ctx, payload), { status: 201 });
  });
}
