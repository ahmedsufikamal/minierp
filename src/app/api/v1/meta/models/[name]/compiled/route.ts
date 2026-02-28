import { NextResponse } from "next/server";
import { getCompiledMeta } from "@/modules/platform/application/meta-model.service";
import { metaCompiledQuerySchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  return withPlatformAuth(request, platformPermissions.metaRead, async (ctx) => {
    const { name } = await context.params;
    const query = parseQuery(request, metaCompiledQuerySchema);
    const compiled = await getCompiledMeta(ctx, name, query);

    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.replaceAll('"', "") === compiled.etag) {
      const notModified = new NextResponse(null, { status: 304 });
      notModified.headers.set("etag", `"${compiled.etag}"`);
      return notModified;
    }

    const response = jsonOk(compiled.payload);
    response.headers.set("etag", `"${compiled.etag}"`);
    return response;
  });
}
