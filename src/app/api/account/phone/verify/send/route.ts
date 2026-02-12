import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { getRequestContext } from "@/modules/iam/interface/request-context";
import { sendPhoneVerifySchema } from "@/modules/iam/interface/schemas";
import { assertRateLimit } from "@/modules/iam/infrastructure/rate-limit";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

function safeInt(value: string | undefined, fallback: number, min = 30, max = 86_400): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const principal = await requireAuth();
    const body = await parseBody(request, sendPhoneVerifySchema);
    const ctx = getRequestContext(request);
    const normalizedPhone = body.phone.trim();

    await assertRateLimit({
      scope: "account_phone_verify_send_user",
      key: principal.userId,
      maxAttempts: safeInt(process.env.IAM_PHONE_VERIFY_OTP_MAX_ATTEMPTS, 6, 1, 100),
      windowSeconds: safeInt(process.env.IAM_PHONE_VERIFY_OTP_WINDOW_SECONDS, 60, 10, 3600),
    });
    await assertRateLimit({
      scope: "account_phone_verify_send_ip",
      key: ctx.ip ?? "unknown",
      maxAttempts: safeInt(process.env.IAM_PHONE_VERIFY_OTP_IP_MAX_ATTEMPTS, 20, 1, 200),
      windowSeconds: safeInt(process.env.IAM_PHONE_VERIFY_OTP_IP_WINDOW_SECONDS, 60, 10, 3600),
    });

    await getIdentityProvider().sendOtp({
      destination: normalizedPhone,
      channel: "SMS",
      purpose: "PHONE_VERIFY",
      userId: principal.userId,
      companyId: principal.activeCompanyId,
      ip: ctx.ip,
    });

    await writeIamAudit({
      action: "OTP_SENT",
      companyId: principal.activeCompanyId,
      actorUserId: principal.userId,
      entityType: "UserPhoneVerification",
      entityId: principal.userId,
      metadata: { phone: normalizedPhone },
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return ok({ sent: true });
  } catch (error) {
    return err(error);
  }
}
