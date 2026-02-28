import { requireAuthPage } from "@/modules/iam";
import { SecuritySettingsClient } from "./security-settings-client";

export const dynamic = "force-dynamic";

export default async function UserSettingsSecurityPage() {
  await requireAuthPage("/settings/user/security");
  return <SecuritySettingsClient />;
}
