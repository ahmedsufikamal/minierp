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
  const expiresAt = payload.expiresAt instanceof Date ? payload.expiresAt : new Date(payload.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error("Legacy session expiresAt must be a valid date");
  }

  return new SignJWT({
    ...payload,
    expiresAt: expiresAt.toISOString(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getJwtKey());
}

export async function decryptSessionToken(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, getJwtKey(), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.userId !== "string" ||
      typeof payload.companyId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.expiresAt !== "string"
    ) {
      return null;
    }

    const expiresAt = new Date(payload.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return null;
    }

    return {
      userId: payload.userId,
      companyId: payload.companyId,
      email: payload.email,
      name: payload.name,
      expiresAt,
    } satisfies SessionPayload;
  } catch {
    return null;
  }
}
