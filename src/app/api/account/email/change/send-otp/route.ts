import { prisma } from "@/lib/prisma";
import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { getRequestContext } from "@/modules/iam/interface/request-context";
import { sendEmailChangeOtpSchema } from "@/modules/iam/interface/schemas";
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
    const body = await parseBody(request, sendEmailChangeOtpSchema);
    const ctx = getRequestContext(request);
    const nextEmail = body.email.trim().toLowerCase();

    if (nextEmail === principal.email) {
      throw new IamError("VALIDATION_ERROR", "New email must be different from current email");
    }

    await assertRateLimit({
      scope: "account_email_change_send_user",
      key: principal.userId,
      maxAttempts: safeInt(process.env.IAM_EMAIL_CHANGE_OTP_MAX_ATTEMPTS, 6, 1, 100),
      windowSeconds: safeInt(process.env.IAM_EMAIL_CHANGE_OTP_WINDOW_SECONDS, 60, 10, 3600),
    });
    await assertRateLimit({
      scope: "account_email_change_send_ip",
      key: ctx.ip ?? "unknown",
      maxAttempts: safeInt(process.env.IAM_EMAIL_CHANGE_OTP_IP_MAX_ATTEMPTS, 20, 1, 200),
      windowSeconds: safeInt(process.env.IAM_EMAIL_CHANGE_OTP_IP_WINDOW_SECONDS, 60, 10, 3600),
    });

    const existing = await prisma.user.findUnique({
      where: { email: nextEmail },
      select: { id: true },
    });
    if (existing && existing.id !== principal.userId) {
      throw new IamError("CONFLICT", "Email is already in use");
    }

    const expiresInSeconds = safeInt(process.env.IAM_EMAIL_CHANGE_OTP_TTL_SECONDS, 600, 120, 7200);
    await prisma.user.update({
      where: { id: principal.userId },
      data: {
        pendingEmail: nextEmail,
        pendingEmailExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      },
    });

    await getIdentityProvider().sendOtp({
      destination: nextEmail,
      channel: "EMAIL",
      purpose: "EMAIL_CHANGE",
      userId: principal.userId,
      companyId: principal.activeCompanyId,
      ip: ctx.ip,
    });

    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: principal.activeCompanyId,
      actorUserId: principal.userId,
      entityType: "User",
      entityId: principal.userId,
      metadata: {
        pendingEmail: nextEmail,
        expiresInSeconds,
      },
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return ok({ sent: true, expiresInSeconds });
  } catch (error) {
    return err(error);
  }
}
