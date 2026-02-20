import { listTenantDomains, upsertTenantDomain } from "@/modules/platform/application/tenants.service";
import { tenantDomainSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";
import { z } from "zod";

const tenantDomainUpsertSchema = tenantDomainSchema.extend({
  tenantId: z.string().trim().min(1).optional(),
});

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.tenantsRead, async (ctx) => {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") || undefined;
    return jsonOk(await listTenantDomains(ctx, tenantId));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.tenantsWrite, async (ctx) => {
    const payload = await parseJson(request, tenantDomainUpsertSchema);
    return jsonOk(
      await upsertTenantDomain(ctx, {
        tenantId: payload.tenantId,
        domain: payload.domain,
        isPrimary: payload.isPrimary,
      }),
      { status: 201 },
    );
  });
}
