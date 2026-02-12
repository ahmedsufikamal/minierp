import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { getRequestContext } from "@/modules/iam/interface/request-context";
import { resetPasswordSchema } from "@/modules/iam/interface/schemas";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";
import { assertRateLimit } from "@/modules/iam/infrastructure/rate-limit";

function safeInt(value: string | undefined, fallback: number, min = 1, max = 86_400): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await parseBody(request, resetPasswordSchema);
    const ctx = getRequestContext(request);
    const email = body.email.trim().toLowerCase();

    await assertRateLimit({
      scope: "password_reset_forced_email",
      key: email,
      maxAttempts: safeInt(process.env.IAM_PASSWORD_RESET_FORCED_MAX_ATTEMPTS, 8, 1, 100),
      windowSeconds: safeInt(process.env.IAM_PASSWORD_RESET_FORCED_WINDOW_SECONDS, 60, 10, 3600),
    });
    await assertRateLimit({
      scope: "password_reset_forced_ip",
      key: ctx.ip ?? "unknown",
      maxAttempts: safeInt(process.env.IAM_PASSWORD_RESET_FORCED_IP_MAX_ATTEMPTS, 20, 1, 200),
      windowSeconds: safeInt(process.env.IAM_PASSWORD_RESET_FORCED_IP_WINDOW_SECONDS, 60, 10, 3600),
    });

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        mustResetPassword: true,
        activeCompanyId: true,
      },
    });
    if (!user) {
      throw new IamError("UNAUTHORIZED", "Invalid credentials");
    }
    if (!user.mustResetPassword) {
      throw new IamError("VALIDATION_ERROR", "Password reset is not required for this account");
    }

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) {
      throw new IamError("UNAUTHORIZED", "Invalid credentials");
    }

    const nextHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: nextHash,
          mustResetPassword: false,
        },
      }),
      prisma.iamSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "SECURITY_EVENT" },
      }),
    ]);

    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: user.activeCompanyId ?? null,
      actorUserId: user.id,
      entityType: "User",
      entityId: user.id,
      metadata: { passwordResetCompleted: true, via: "api" },
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return ok({ reset: true });
  } catch (error) {
    return err(error);
  }
}
