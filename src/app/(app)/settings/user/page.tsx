import { requireAuthPage } from "@/modules/iam";
import { SettingsList } from "@/components/records/settings-list";

export const dynamic = "force-dynamic";

const settingsItems = [
  { label: "Desk Settings", href: "/settings/user/profile#desk", description: "Workspace layout and landing behavior." },
  { label: "Navigation Settings", href: "/settings/user/profile#navigation", description: "Sidebar and module navigation preferences." },
  { label: "List Settings", href: "/settings/user/profile#lists", description: "Default list density and filters." },
  { label: "Form Settings", href: "/settings/user/profile#forms", description: "Editing behavior and form defaults." },
  { label: "Change Password", href: "/settings/user/security#password", description: "Update your password and recovery posture." },
  { label: "Document Follow", href: "/settings/user/profile#follows", description: "Notification rules for watched records." },
  { label: "Email", href: "/settings/user/profile#email", description: "Primary email information and delivery notes." },
  { label: "Workspace", href: "/settings/user/profile#workspace", description: "Workspace shortcuts and default views." },
  { label: "App", href: "/settings/user/profile#app", description: "Theme and desktop preferences." },
  { label: "Security Settings", href: "/settings/user/security", description: "Password, MFA, and recent sign-ins." },
  { label: "Third Party Authentication", href: "/settings/user/connections", description: "Connected providers and SSO stubs." },
  { label: "API Access", href: "/settings/user/api", description: "Token management and integration access." },
] as const;

export default async function UserSettingsLandingPage() {
  await requireAuthPage("/settings/user");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Settings / User</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">User Settings</h1>
        <p className="text-sm text-muted-foreground">Personal workspace, security posture, and connected tools.</p>
      </div>
      <SettingsList title="Preferences" items={[...settingsItems]} />
    </div>
  );
}
