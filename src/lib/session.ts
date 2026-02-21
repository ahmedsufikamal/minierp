import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  decryptSessionToken,
  encryptSessionToken,
  type SessionPayload,
} from "@/lib/legacy-session-token";
import { prisma } from "@/lib/prisma";
import { getSessionCookieDomain } from "@/lib/runtime-env";
import { getIdentityProvider } from "@/modules/iam/infrastructure/provider";
import { clearSessionCookie } from "@/modules/iam/infrastructure/session";

function isIamV2Enabled(): boolean {
  return process.env.IAM_V2_ENABLED === "1";
}

function isDualWriteLegacySessionEnabled(): boolean {
  const explicit = process.env.IAM_DUAL_WRITE_LEGACY_SESSION;
  if (explicit === "1") return true;
  return false;
}

export type { SessionPayload } from "@/lib/legacy-session-token";

export async function encrypt(payload: SessionPayload) {
  return encryptSessionToken(payload);
}

export async function decrypt(session: string | undefined = "") {
  return decryptSessionToken(session);
}

export async function setLegacySessionCookie(
  payload: Omit<SessionPayload, "expiresAt"> & { expiresAt?: Date },
) {
  const expiresAt = payload.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({
    userId: payload.userId,
    companyId: payload.companyId,
    email: payload.email,
    name: payload.name,
    expiresAt,
  });

  const cookieStore = await cookies();
  const domain = getSessionCookieDomain();
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
    ...(domain ? { domain } : {}),
  });
}

export async function syncLegacyFromIamSession(): Promise<void> {
  if (!isDualWriteLegacySessionEnabled()) return;

  const cookieStore = await cookies();
  const token = cookieStore.get("iam_session")?.value;
  if (!token) return;

  const provider = getIdentityProvider();
  const principal = await provider.verifySession(token);
  if (!principal) return;

  const expiresAt =
    (
      await prisma.iamSession.findUnique({
        where: { id: principal.sessionId },
        select: { expiresAt: true },
      })
    )?.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await setLegacySessionCookie({
    userId: principal.userId,
    companyId: principal.activeCompanyId,
    email: principal.email,
    name: principal.name,
    expiresAt,
  });
}

export async function createSession(userId: string, companyId: string, email: string, name: string) {
  if (isIamV2Enabled()) {
    const { createSessionRecord, setSessionCookie } = await import("@/modules/iam/infrastructure/session");
    const created = await createSessionRecord({
      userId,
      companyId,
    });
    await setSessionCookie(created.token, created.expiresAt);
    if (isDualWriteLegacySessionEnabled()) {
      await setLegacySessionCookie({ userId, companyId, email, name, expiresAt: created.expiresAt });
    }
    return;
  }

  await setLegacySessionCookie({ userId, companyId, email, name });
}

export async function verifySession() {
  const cookieStore = await cookies();

  if (isIamV2Enabled()) {
    const token = cookieStore.get("iam_session")?.value;
    const provider = getIdentityProvider();
    const principal = await provider.verifySession(token);

    if (!principal?.userId) {
      redirect("/auth/sign-in");
    }
    if (principal.mustResetPassword) {
      redirect("/auth/reset-password");
    }
    if (principal.mfaRequired) {
      redirect("/auth/mfa?required=1");
    }

    return {
      isAuth: true,
      userId: principal.userId,
      companyId: principal.activeCompanyId,
      email: principal.email,
      name: principal.name,
      role: principal.membershipRole,
      platformRole: principal.platformRole,
      permissions: principal.permissions,
      sessionId: principal.sessionId,
      stepUpVerifiedAt: principal.stepUpVerifiedAt,
      mfaRequired: principal.mfaRequired,
      mustResetPassword: principal.mustResetPassword,
      isImpersonating: principal.isImpersonating,
      impersonatorUserId: principal.impersonatorUserId,
      impersonationExpiresAt: principal.impersonationExpiresAt,
      deviceFingerprint: principal.deviceFingerprint,
    };
  }

  const session = cookieStore.get("session")?.value;
  const payload = await decrypt(session);

  if (!payload?.userId) {
    redirect("/sign-in");
  }

  return {
    isAuth: true,
    userId: payload.userId,
    companyId: payload.companyId,
    email: payload.email,
    name: payload.name,
  };
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const domain = getSessionCookieDomain();

  if (isIamV2Enabled()) {
    const token = cookieStore.get("iam_session")?.value;
    if (token) {
      const provider = getIdentityProvider();
      const principal = await provider.verifySession(token);
      if (principal) {
        await provider.revokeSession(principal.sessionId, principal.userId);
      }
    }
    await clearSessionCookie();
    cookieStore.set("session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      ...(domain ? { domain } : {}),
    });
    return;
  }

  cookieStore.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
}
