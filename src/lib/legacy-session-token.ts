import { SignJWT, jwtVerify } from "jose";

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

export async function encryptSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtKey());
}

export async function decryptSessionToken(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, getJwtKey(), {
      algorithms: ["HS256"],
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
