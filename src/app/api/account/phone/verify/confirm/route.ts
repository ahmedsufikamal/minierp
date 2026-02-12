import { prisma } from "@/lib/prisma";
import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { getRequestContext } from "@/modules/iam/interface/request-context";
import { confirmPhoneVerifySchema } from "@/modules/iam/interface/schemas";
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
    const body = await parseBody(request, confirmPhoneVerifySchema);
    const ctx = getRequestContext(request);
    const normalizedPhone = body.phone.trim();

    await assertRateLimit({
      scope: "account_phone_verify_confirm_user",
      key: principal.userId,
      maxAttempts: safeInt(process.env.IAM_PHONE_VERIFY_CONFIRM_MAX_ATTEMPTS, 10, 1, 100),
      windowSeconds: safeInt(process.env.IAM_PHONE_VERIFY_CONFIRM_WINDOW_SECONDS, 60, 10, 3600),
    });
    await assertRateLimit({
      scope: "account_phone_verify_confirm_ip",
      key: ctx.ip ?? "unknown",
      maxAttempts: safeInt(process.env.IAM_PHONE_VERIFY_CONFIRM_IP_MAX_ATTEMPTS, 25, 1, 200),
      windowSeconds: safeInt(process.env.IAM_PHONE_VERIFY_CONFIRM_IP_WINDOW_SECONDS, 60, 10, 3600),
    });

    await getIdentityProvider().verifyOtp({
      destination: normalizedPhone,
      code: body.code,
      purpose: "PHONE_VERIFY",
    });

    const updated = await prisma.user.update({
      where: { id: principal.userId },
      data: {
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
      },
      select: {
        id: true,
        phone: true,
        phoneVerifiedAt: true,
      },
    });

    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: principal.activeCompanyId,
      actorUserId: principal.userId,
      entityType: "User",
      entityId: principal.userId,
      after: {
        phone: updated.phone,
        phoneVerifiedAt: updated.phoneVerifiedAt,
      },
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return ok(updated);
  } catch (error) {
    return err(error);
  }
}
