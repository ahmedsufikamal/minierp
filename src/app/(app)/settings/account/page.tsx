import { getIdentityProvider } from "@/modules/iam/infrastructure/provider";
import { requireAuthPage } from "@/modules/iam";
import { revokeAllSessionsAction, revokeSessionAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function AccountSettingsPage() {
  const principal = await requireAuthPage("/settings/account");
  const sessions = await getIdentityProvider().listUserSessions(principal.userId);
  const submitRevokeAll = async () => {
    "use server";
    await revokeAllSessionsAction();
  };
  const submitRevokeOne = async (formData: FormData) => {
    "use server";
    await revokeSessionAction({}, formData);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account settings</h1>
        <p className="text-sm text-muted-foreground">Profile, sessions, and multi-factor security.</p>
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Profile</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Input value={principal.name} readOnly />
          <Input value={principal.email} readOnly />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Active sessions</h2>
          <form action={submitRevokeAll}>
            <Button type="submit" variant="destructive">Revoke all sessions</Button>
          </form>
        </div>

        <div className="space-y-2">
          {sessions.map((session) => (
            <form key={session.id} action={submitRevokeOne} className="flex items-center justify-between rounded border p-3">
              <input type="hidden" name="sessionId" value={session.id} />
              <div>
                <p className="text-sm font-medium">{session.userAgent || "Unknown device"}</p>
                <p className="text-xs text-muted-foreground">{session.ip || "Unknown IP"} · Last seen {new Date(session.lastSeenAt).toLocaleString()}</p>
              </div>
              <Button type="submit" variant="outline">Revoke</Button>
            </form>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">MFA</h2>
        <p className="text-sm text-muted-foreground">Manage authenticator enrollment and step-up verification.</p>
        <Button asChild>
          <a href="/auth/mfa">Manage MFA</a>
        </Button>
      </section>
    </div>
  );
}
