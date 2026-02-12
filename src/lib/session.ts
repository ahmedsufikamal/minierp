import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIdentityProvider } from "@/modules/iam/infrastructure/provider";
import { clearSessionCookie } from "@/modules/iam/infrastructure/session";

function getJwtKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET environment variable is required and must be at least 32 characters. Set it in .env for development and in your deployment config for production.",
    );
  }
  return new TextEncoder().encode(secret);
}

function isIamV2Enabled(): boolean {
  return process.env.IAM_V2_ENABLED === "1";
}

export type SessionPayload = {
  userId: string;
  companyId: string;
  email: string;
  name: string;
  expiresAt: Date;
};

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtKey());
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, getJwtKey(), {
      algorithms: ["HS256"],
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, companyId: string, email: string, name: string) {
  if (isIamV2Enabled()) {
    void email;
    void name;
    const { createSessionRecord, setSessionCookie } = await import("@/modules/iam/infrastructure/session");
    const created = await createSessionRecord({
      userId,
      companyId,
    });
    await setSessionCookie(created.token, created.expiresAt);
    return;
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({ userId, companyId, email, name, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
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
    cookieStore.delete("session");
    return;
  }

  cookieStore.delete("session");
}
