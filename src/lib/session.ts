import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function getJwtKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET environment variable is required and must be at least 32 characters. Set it in .env for development and in your deployment config for production.",
    );
  }
  return new TextEncoder().encode(secret);
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
  cookieStore.delete("session");
}
