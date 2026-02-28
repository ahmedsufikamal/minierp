import { redirect } from "next/navigation";

export default function AccountSettingsRedirectPage() {
  redirect("/settings/user");
}
