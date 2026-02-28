import { z } from "zod";
import { requirePlatformAdmin } from "@/modules/iam";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { err, ok, parseBody } from "@/modules/iam/interface/http";
import { getAdminUserDetail, updateAdminUserBasics } from "@/modules/iam/application/user-admin.service";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  avatarUrl: z.string().trim().nullable().optional(),
  status: z.enum(["ACTIVE", "INVITED", "SUSPENDED", "DISABLED"]).optional(),
  platformRole: z.enum(["SUPER_ADMIN", "SUPPORT", "NONE"]).optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const principal = await requirePlatformAdmin();
    const { id } = await params;
    const data = await getAdminUserDetail(id, principal);
    return ok(data);
  } catch (error) {
    return err(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePlatformAdmin();
    const body = await parseBody(request, updateSchema);
    const { id } = await params;
    const data = await updateAdminUserBasics({ actor: principal, targetUserId: id, data: body });
    return ok(data);
  } catch (error) {
    return err(error);
  }
}
