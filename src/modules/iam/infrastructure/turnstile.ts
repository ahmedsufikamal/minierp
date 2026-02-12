import { IamError } from "@/modules/iam/domain/errors";

export async function verifyTurnstileToken(input: { token?: string | null; ip?: string | null }) {
  const enabled = process.env.IAM_TURNSTILE_ENABLED === "1";
  if (!enabled) return;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new IamError("BOT_PROTECTION_FAILED", "Turnstile secret key is not configured");
  }
  if (!input.token) {
    throw new IamError("BOT_PROTECTION_FAILED", "Turnstile token missing");
  }

  const body = new URLSearchParams({
    secret,
    response: input.token,
    remoteip: input.ip ?? "",
  });

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new IamError("BOT_PROTECTION_FAILED", "Turnstile verification failed");
  }

  const data = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
  if (!data.success) {
    throw new IamError("BOT_PROTECTION_FAILED", "Turnstile rejected request", data["error-codes"] ?? []);
  }
}
