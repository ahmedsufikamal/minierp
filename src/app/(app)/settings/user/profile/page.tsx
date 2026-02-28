import { requireAuthPage } from "@/modules/iam";
import { ProfileSettingsClient } from "./profile-settings-client";

export const dynamic = "force-dynamic";

export default async function UserSettingsProfilePage() {
  await requireAuthPage("/settings/user/profile");
  return <ProfileSettingsClient />;
}
