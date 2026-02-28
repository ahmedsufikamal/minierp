import { requirePlatformAdminPage } from "@/modules/iam";
import { AdminUserRecordClient } from "./user-record-client";

export const dynamic = "force-dynamic";

export default async function AdminUserRecordPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdminPage("/admin/users");
  const { id } = await params;
  return <AdminUserRecordClient userId={id} />;
}
