import { headers } from "next/headers";
import { getIdentityProvider } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { assertRateLimit } from "@/modules/iam/infrastructure/rate-limit";
import { err, ok, parseSearch } from "@/modules/iam/interface/http";
import { previewInviteQuerySchema } from "@/modules/iam/interface/schemas";

function safeInt(value: string | undefined, fallback: number, min = 1, max = 10_000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function isInviteSignupBridgeEnabled(): boolean {
  const explicit = process.env.IAM_INVITE_SIGNUP_BRIDGE_ENABLED;
  if (explicit === "1") return true;
  if (explicit === "0") return false;
  return true;
}

export async function GET(request: Request) {
  try {
    if (!isInviteSignupBridgeEnabled()) {
      throw new IamError("FORBIDDEN", "Invite preview is disabled");
    }

    const query = parseSearch(request, previewInviteQuerySchema);
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

    await assertRateLimit({
      scope: "invite_preview",
      key: `${query.token}:${ip}`,
      maxAttempts: safeInt(process.env.IAM_INVITE_PREVIEW_RATE_LIMIT_MAX_ATTEMPTS, 25, 1, 500),
      windowSeconds: safeInt(process.env.IAM_INVITE_PREVIEW_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });

    const invite = await getIdentityProvider().previewInvite(query.token);
    return ok(invite);
  } catch (error) {
    return err(error);
  }
}
