import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { getRequestContext } from "@/modules/iam/interface/request-context";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { mfaEnrollSchema } from "@/modules/iam/interface/schemas";
import { assertRateLimit } from "@/modules/iam/infrastructure/rate-limit";

function safeInt(value: string | undefined, fallback: number, min = 1, max = 10_000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await parseBody(request, mfaEnrollSchema);
    const principal = await requireAuth({ allowMfaPending: true });
    const ctx = getRequestContext(request);

    await assertRateLimit({
      scope: "mfa_enroll_user",
      key: principal.userId,
      maxAttempts: safeInt(process.env.IAM_MFA_ENROLL_RATE_LIMIT_MAX_ATTEMPTS, 6, 1, 100),
      windowSeconds: safeInt(process.env.IAM_MFA_ENROLL_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });
    await assertRateLimit({
      scope: "mfa_enroll_ip",
      key: ctx.ip ?? "unknown",
      maxAttempts: safeInt(process.env.IAM_MFA_ENROLL_IP_RATE_LIMIT_MAX_ATTEMPTS, 20, 1, 500),
      windowSeconds: safeInt(process.env.IAM_MFA_ENROLL_IP_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });

    const data = await getIdentityProvider().enrollMfa({
      userId: principal.userId,
      label: body.label,
    });

    return ok(data);
  } catch (error) {
    return err(error);
  }
}
