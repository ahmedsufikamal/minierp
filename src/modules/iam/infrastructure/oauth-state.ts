import { cookies } from "next/headers";
import { hashToken, randomToken } from "@/modules/iam/infrastructure/crypto";
import { IamError } from "@/modules/iam/domain/errors";

const COOKIE_NAME = "iam_oauth_state";

export async function issueOAuthState(): Promise<string> {
  const state = randomToken(24);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, hashToken(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return state;
}

export async function verifyOAuthState(state: string | null | undefined): Promise<void> {
  if (!state) throw new IamError("UNAUTHORIZED", "OAuth state is missing");
  const cookieStore = await cookies();
  const expected = cookieStore.get(COOKIE_NAME)?.value;
  cookieStore.delete(COOKIE_NAME);
  if (!expected || expected !== hashToken(state)) {
    throw new IamError("UNAUTHORIZED", "OAuth state mismatch");
  }
}
