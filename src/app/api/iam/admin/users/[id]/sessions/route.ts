import { requirePlatformAdmin } from "@/modules/iam";
import { err, ok } from "@/modules/iam/interface/http";
import { listAdminUserSessions } from "@/modules/iam/application/user-admin.service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const principal = await requirePlatformAdmin();
    const { id } = await params;
    const data = await listAdminUserSessions(id, principal);
    return ok(data);
  } catch (error) {
    return err(error);
  }
}
