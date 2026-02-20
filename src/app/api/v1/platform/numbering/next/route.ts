import { allocateSeriesNumber } from "@/modules/platform/application/numbering.service";
import { numberSeriesAllocateSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.numberingWrite, async (ctx) => {
    const payload = await parseJson(request, numberSeriesAllocateSchema);
    return jsonOk(await allocateSeriesNumber(ctx, payload), { status: 201 });
  });
}
