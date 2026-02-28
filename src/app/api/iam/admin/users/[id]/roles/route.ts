import { z } from "zod";
import { requirePlatformAdmin } from "@/modules/iam";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { err, ok, parseBody } from "@/modules/iam/interface/http";
import { updateUserMembershipAccess } from "@/modules/iam/application/user-admin.service";

const bodySchema = z.object({
  companyId: z.string().min(1),
  roleId: z.string().min(1),
  userTypeLevel: z.number().int().optional(),
  permissionKeys: z.array(z.string().min(1)).default([]),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePlatformAdmin();
    const body = await parseBody(request, bodySchema);
    const { id } = await params;
    const data = await updateUserMembershipAccess({
      actor: principal,
      targetUserId: id,
      companyId: body.companyId,
      roleId: body.roleId,
      userTypeLevel: body.userTypeLevel,
      permissionKeys: body.permissionKeys,
    });
    return ok(data);
  } catch (error) {
    return err(error);
  }
}
