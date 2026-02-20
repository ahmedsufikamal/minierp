import { createTenant, listTenants } from "@/modules/platform/application/tenants.service";
import { tenantCreateSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.tenantsRead, async (ctx) => {
    return jsonOk(await listTenants(ctx));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.tenantsWrite, async (ctx) => {
    const payload = await parseJson(request, tenantCreateSchema);
    return jsonOk(await createTenant(ctx, payload), { status: 201 });
  });
}
