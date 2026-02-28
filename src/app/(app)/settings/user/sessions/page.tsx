import { requireAuthPage } from "@/modules/iam";
import { SessionsSettingsClient } from "./sessions-settings-client";

export const dynamic = "force-dynamic";

export default async function UserSettingsSessionsPage() {
  await requireAuthPage("/settings/user/sessions");
  return <SessionsSettingsClient />;
}
