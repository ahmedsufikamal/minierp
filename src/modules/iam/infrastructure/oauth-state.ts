import { cookies } from "next/headers";
import { getSessionCookieDomain } from "@/lib/runtime-env";
import { hashToken, randomToken } from "@/modules/iam/infrastructure/crypto";
import { IamError } from "@/modules/iam/domain/errors";
import crypto from "node:crypto";

const COOKIE_NAME = "iam_oauth_state";

export async function issueOAuthState(): Promise<string> {
  const state = randomToken(24);
  const cookieStore = await cookies();
  const domain = getSessionCookieDomain();
  cookieStore.set(COOKIE_NAME, hashToken(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
    ...(domain ? { domain } : {}),
  });
  return state;
}

export async function verifyOAuthState(state: string | null | undefined): Promise<void> {
  if (!state) throw new IamError("UNAUTHORIZED", "OAuth state is missing");
  const cookieStore = await cookies();
  const expected = cookieStore.get(COOKIE_NAME)?.value;
  cookieStore.delete(COOKIE_NAME);
  if (!expected) {
    throw new IamError("UNAUTHORIZED", "OAuth state mismatch");
  }
  const actual = hashToken(state);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  const valid =
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  if (!valid) {
    throw new IamError("UNAUTHORIZED", "OAuth state mismatch");
  }
}
