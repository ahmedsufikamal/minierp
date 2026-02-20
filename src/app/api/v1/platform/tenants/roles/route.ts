import { listRoleProfiles, upsertRoleProfile } from "@/modules/platform/application/tenants.service";
import { roleProfileSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";
import { z } from "zod";

const roleProfileUpsertSchema = roleProfileSchema.extend({
  id: z.string().trim().min(1).optional(),
});

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.rbacRead, async (ctx) => {
    return jsonOk(await listRoleProfiles(ctx));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.rbacWrite, async (ctx) => {
    const payload = await parseJson(request, roleProfileUpsertSchema);
    return jsonOk(
      await upsertRoleProfile(ctx, {
        id: payload.id,
        name: payload.name,
        description: payload.description,
        isDefault: payload.isDefault,
      }),
      { status: 201 },
    );
  });
}
