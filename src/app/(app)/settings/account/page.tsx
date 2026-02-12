import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getIdentityProvider } from "@/modules/iam/infrastructure/provider";
import { requireAuth, requireAuthPage, requireStepUp } from "@/modules/iam";
import { revokeAllSessionsAction, revokeSessionAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountSettingsPage(props: PageProps) {
  const principal = await requireAuthPage("/settings/account");
  const searchParams = (await props.searchParams) ?? {};
  const recoveryParam = String(searchParams.recovery ?? "");
  const regeneratedRecoveryCodes = recoveryParam ? recoveryParam.split(",").filter(Boolean) : [];
  const user = await prisma.user.findUnique({
    where: { id: principal.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      phoneVerifiedAt: true,
      emailVerifiedAt: true,
      pendingEmail: true,
      pendingEmailExpiresAt: true,
      avatarUrl: true,
    },
  });
  const sessions = await getIdentityProvider().listUserSessions(principal.userId);
  const factors = await getIdentityProvider().listMfaFactors(principal.userId);

  const submitUpdateProfile = async (formData: FormData) => {
    "use server";
    const auth = await requireAuth();
    const nextName = String(formData.get("name") || "").trim();
    const nextPhone = String(formData.get("phone") || "").trim();
    const nextAvatarUrl = String(formData.get("avatarUrl") || "").trim();
    const nextEmail = String(formData.get("email") || "").trim().toLowerCase();
    const emailOtpCode = String(formData.get("emailOtpCode") || "").trim();
    const phoneOtpCode = String(formData.get("phoneOtpCode") || "").trim();
    const existing = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        email: true,
        phone: true,
        pendingEmail: true,
        pendingEmailExpiresAt: true,
      },
    });
    if (!existing) throw new Error("User not found");

    const isEmailChange = Boolean(nextEmail && nextEmail !== existing.email);
    const isPhoneChange = Boolean(nextPhone && nextPhone !== existing.phone);

    if (isEmailChange && nextEmail) {
      if (!emailOtpCode) {
        throw new Error("Email OTP code is required when changing email");
      }
      if (!existing.pendingEmail || existing.pendingEmail !== nextEmail) {
        throw new Error("Request a fresh OTP for this email first");
      }
      if (!existing.pendingEmailExpiresAt || existing.pendingEmailExpiresAt <= new Date()) {
        throw new Error("Email OTP challenge expired; request a new one");
      }
      await getIdentityProvider().verifyOtp({
        destination: nextEmail,
        code: emailOtpCode,
        purpose: "EMAIL_CHANGE",
      });
    }
    if (isPhoneChange && nextPhone) {
      if (!phoneOtpCode) {
        throw new Error("Phone OTP code is required when changing phone");
      }
      await getIdentityProvider().verifyOtp({
        destination: nextPhone,
        code: phoneOtpCode,
        purpose: "PHONE_VERIFY",
      });
    }

    await prisma.user.update({
      where: { id: auth.userId },
        data: {
          name: nextName || undefined,
          phone: nextPhone || null,
          phoneVerifiedAt: isPhoneChange ? (nextPhone ? new Date() : null) : undefined,
          avatarUrl: nextAvatarUrl || null,
        email: isEmailChange ? nextEmail : undefined,
        emailVerifiedAt: isEmailChange ? new Date() : undefined,
        pendingEmail: isEmailChange ? null : undefined,
        pendingEmailExpiresAt: isEmailChange ? null : undefined,
      },
    });

    revalidatePath("/settings/account");
  };
  const submitSendEmailOtp = async (formData: FormData) => {
    "use server";
    const auth = await requireAuth();
    const nextEmail = String(formData.get("email") || "").trim().toLowerCase();
    if (!nextEmail) throw new Error("Enter an email first");
    if (nextEmail === auth.email) throw new Error("Enter a different email to verify");

    await prisma.user.update({
      where: { id: auth.userId },
      data: {
        pendingEmail: nextEmail,
        pendingEmailExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    await getIdentityProvider().sendOtp({
      destination: nextEmail,
      channel: "EMAIL",
      purpose: "EMAIL_CHANGE",
      userId: auth.userId,
      companyId: auth.activeCompanyId,
    });
    revalidatePath("/settings/account");
  };
  const submitSendPhoneOtp = async (formData: FormData) => {
    "use server";
    const auth = await requireAuth();
    const phone = String(formData.get("phone") || "").trim();
    if (!phone) throw new Error("Enter a phone number first");
    await getIdentityProvider().sendOtp({
      destination: phone,
      channel: "SMS",
      purpose: "PHONE_VERIFY",
      userId: auth.userId,
      companyId: auth.activeCompanyId,
    });
    revalidatePath("/settings/account");
  };

  const submitChangePassword = async (formData: FormData) => {
    "use server";
    const auth = await requireAuth();
    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");
    const userRow = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, passwordHash: true },
    });
    if (!userRow) throw new Error("User not found");

    const valid = await bcrypt.compare(currentPassword, userRow.passwordHash);
    if (!valid) {
      throw new Error("Current password is invalid");
    }

    const nextHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: auth.userId },
      data: { passwordHash: nextHash, mustResetPassword: false },
    });
    await prisma.iamSession.updateMany({
      where: { userId: auth.userId, revokedAt: null, id: { not: auth.sessionId } },
      data: { revokedAt: new Date(), revokeReason: "SECURITY_EVENT" },
    });

    revalidatePath("/settings/account");
  };

  const submitRevokeAll = async () => {
    "use server";
    await revokeAllSessionsAction();
  };
  const submitRevokeOne = async (formData: FormData) => {
    "use server";
    await revokeSessionAction({}, formData);
  };
  const submitRemoveMfaFactor = async (formData: FormData) => {
    "use server";
    const auth = await requireAuth();
    await requireStepUp();
    const factorId = String(formData.get("factorId") || "");
    await getIdentityProvider().removeMfaFactor({
      userId: auth.userId,
      factorId,
    });
    revalidatePath("/settings/account");
  };
  const submitSetPrimaryMfaFactor = async (formData: FormData) => {
    "use server";
    const auth = await requireAuth();
    await requireStepUp();
    const factorId = String(formData.get("factorId") || "");
    await getIdentityProvider().setPrimaryMfaFactor({
      userId: auth.userId,
      factorId,
    });
    revalidatePath("/settings/account");
  };
  const submitRegenerateRecoveryCodes = async (formData: FormData) => {
    "use server";
    const auth = await requireAuth();
    await requireStepUp();
    const factorId = String(formData.get("factorId") || "");
    const codes = await getIdentityProvider().regenerateRecoveryCodes({
      userId: auth.userId,
      factorId,
    });
    redirect(`/settings/account?recovery=${encodeURIComponent(codes.join(","))}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account settings</h1>
        <p className="text-sm text-muted-foreground">Profile, sessions, and multi-factor security.</p>
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Profile</h2>
        <form action={submitUpdateProfile} className="grid gap-3 md:grid-cols-2">
          <Input name="name" defaultValue={user?.name ?? principal.name} />
          <Input name="email" type="email" defaultValue={user?.email ?? principal.email} />
          <Input name="phone" defaultValue={user?.phone ?? ""} placeholder="Phone number" />
          <Input name="avatarUrl" defaultValue={user?.avatarUrl ?? ""} placeholder="Avatar URL" />
          <Input name="emailOtpCode" placeholder="OTP for email change (if changing)" />
          <Input name="phoneOtpCode" placeholder="OTP for phone change (if changing)" />
          {user?.pendingEmail ? (
            <p className="md:col-span-2 text-xs text-muted-foreground">
              Pending email verification for {user.pendingEmail}
              {user.pendingEmailExpiresAt ? ` (expires ${new Date(user.pendingEmailExpiresAt).toLocaleTimeString()})` : ""}
            </p>
          ) : null}
          <p className="md:col-span-2 text-xs text-muted-foreground">
            Current verification status: email {user?.emailVerifiedAt ? "verified" : "unverified"} · phone {user?.phoneVerifiedAt ? "verified" : "unverified"}
          </p>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button type="submit" formAction={submitSendEmailOtp} variant="outline">Send email OTP</Button>
            <Button type="submit" formAction={submitSendPhoneOtp} variant="outline">Send phone OTP</Button>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" variant="outline">Save profile</Button>
          </div>
        </form>
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
        {regeneratedRecoveryCodes.length > 0 ? (
          <div className="space-y-2 rounded border p-3">
            <p className="text-sm font-medium">New recovery codes</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {regeneratedRecoveryCodes.map((code) => (
                <span key={code} className="rounded bg-muted px-2 py-1 font-mono">{code}</span>
              ))}
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          {factors.map((factor) => (
            <div key={factor.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
              <div>
                <p className="font-medium">{factor.label || factor.type}</p>
                <p className="text-xs text-muted-foreground">
                  {factor.type} · {factor.isVerified ? "verified" : "pending"} · {factor.isPrimary ? "primary" : "secondary"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!factor.isPrimary ? (
                  <form action={submitSetPrimaryMfaFactor}>
                    <input type="hidden" name="factorId" value={factor.id} />
                    <Button type="submit" variant="outline" size="sm">Set primary</Button>
                  </form>
                ) : null}
                <form action={submitRegenerateRecoveryCodes}>
                  <input type="hidden" name="factorId" value={factor.id} />
                  <Button type="submit" variant="outline" size="sm">Regenerate recovery codes</Button>
                </form>
                <form action={submitRemoveMfaFactor}>
                  <input type="hidden" name="factorId" value={factor.id} />
                  <Button type="submit" variant="outline" size="sm">Remove factor</Button>
                </form>
              </div>
            </div>
          ))}
        </div>
        <Button asChild>
          <a href="/auth/mfa">Manage MFA</a>
        </Button>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Password</h2>
        <form action={submitChangePassword} className="grid gap-3 md:grid-cols-2">
          <Input name="currentPassword" type="password" placeholder="Current password" required />
          <Input name="newPassword" type="password" placeholder="New password" required />
          <div className="md:col-span-2">
            <Button type="submit" variant="outline">Change password</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
