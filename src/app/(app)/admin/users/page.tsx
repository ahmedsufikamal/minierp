import { requirePlatformAdminPage } from "@/modules/iam";
import { AdminUsersClient } from "./users-admin-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requirePlatformAdminPage("/admin/users");
  return <AdminUsersClient />;
}
