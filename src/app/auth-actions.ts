"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getIdentityProvider } from "@/modules/iam/infrastructure/provider";
import { createSession, deleteSession, syncLegacyFromIamSession } from "@/lib/session";
import {
  sendMagicLinkSchema,
  resetPasswordSchema,
  mfaRecoveryVerifySchema,
  mfaEnrollSchema,
  mfaVerifySchema,
  sessionRevokeSchema,
  signInSchema,
  signUpSchema,
  verifyMagicLinkSchema,
} from "@/modules/iam/interface/schemas";
import { requireAuth, requireStepUp } from "@/modules/iam";
import { IamError, isIamError } from "@/modules/iam/domain/errors";
import { assertRateLimit } from "@/modules/iam/infrastructure/rate-limit";
import { verifyTurnstileToken } from "@/modules/iam/infrastructure/turnstile";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";
import type { AuthActionError } from "@/modules/iam/interface/action-error";
import {
  createDemoUserMissingAuthActionError,
  createSetupRequiredAuthActionError,
  createValidationAuthActionError,
  mapAuthActionError,
} from "@/modules/iam/application/auth-action-error-mapper";

function isIamV2Enabled(): boolean {
  return process.env.IAM_V2_ENABLED === "1";
}

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

function safeInt(value: string | undefined, fallback: number, min = 1, max = 86_400): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

async function applyAuthAbuseChecks(input: {
  scope: string;
  key: string;
  ip: string | null;
  turnstileToken?: string;
  maxAttempts: number;
  windowSeconds: number;
}) {
  await assertRateLimit({
    key: `${input.key}:${input.ip ?? "unknown"}`,
    scope: input.scope,
    maxAttempts: input.maxAttempts,
    windowSeconds: input.windowSeconds,
  });

  await verifyTurnstileToken({
    token: input.turnstileToken,
    ip: input.ip,
  });
}

function toActionError(error: unknown, requestId: string): AuthActionError {
  return mapAuthActionError({
    error,
    requestId,
    isProduction: isProductionEnvironment(),
  });
}

async function legacySignIn(input: { email: string; password: string }) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      companyId: true,
    },
  });

  if (!user) {
    throw new IamError("UNAUTHORIZED", "Invalid credentials");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new IamError("UNAUTHORIZED", "Invalid credentials");
  }

  await createSession(user.id, user.companyId, user.email, user.name);
}

async function requestContext() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip");
  const userAgent = h.get("user-agent");
  const requestId = h.get("x-request-id")?.trim() || crypto.randomUUID();
  return { ip: ip ?? null, userAgent: userAgent ?? null, requestId };
}

function formToObject(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  for (const key of ["rememberMe"]) {
    if (key in raw) {
      raw[key] = raw[key] === "on" || raw[key] === "true";
    }
  }
  return raw;
}

function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return null;
  return normalized;
}

function getConfiguredSeedDemoEmails(): Set<string> {
  return new Set(
    [process.env.SEED_OWNER_EMAIL || "owner@demo.local", process.env.SEED_MANAGER_EMAIL || "manager@demo.local"]
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  );
}

export async function signup(prevState: unknown, formData: FormData) {
  const ctx = await requestContext();
  const parsed = signUpSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: createValidationAuthActionError(parsed.error.issues[0]?.message ?? "Invalid input", ctx.requestId) };
  }

  try {
    const provider = getIdentityProvider();
    await applyAuthAbuseChecks({
      scope: "signup",
      key: parsed.data.email.trim().toLowerCase(),
      ip: ctx.ip,
      turnstileToken: parsed.data.turnstileToken,
      maxAttempts: safeInt(process.env.IAM_SIGNUP_RATE_LIMIT_MAX_ATTEMPTS, 5, 1, 50),
      windowSeconds: safeInt(process.env.IAM_SIGNUP_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });

    await provider.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
      companyName: parsed.data.companyName,
      companySlug: parsed.data.companySlug,
      inviteToken: parsed.data.inviteToken,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    if (isIamV2Enabled()) {
      await syncLegacyFromIamSession();
    }
  } catch (error) {
    return { error: toActionError(error, ctx.requestId) };
  }

  redirect(safeNextPath(parsed.data.next) ?? "/dashboard");
}

export async function signin(prevState: unknown, formData: FormData) {
  const ctx = await requestContext();
  const parsed = signInSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: createValidationAuthActionError(parsed.error.issues[0]?.message ?? "Invalid input", ctx.requestId) };
  }
  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  let mfaRequired = false;
  try {
    if (getConfiguredSeedDemoEmails().has(normalizedEmail)) {
      const demoAccount = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (!demoAccount) {
        return {
          error: createDemoUserMissingAuthActionError({
            requestId: ctx.requestId,
            isProduction: isProductionEnvironment(),
            email: normalizedEmail,
          }),
        };
      }
    }

    if ((await prisma.user.count()) === 0) {
      return {
        error: createSetupRequiredAuthActionError({
          requestId: ctx.requestId,
          isProduction: isProductionEnvironment(),
        }),
      };
    }

    await applyAuthAbuseChecks({
      scope: "signin",
      key: parsed.data.email.trim().toLowerCase(),
      ip: ctx.ip,
      turnstileToken: parsed.data.turnstileToken,
      maxAttempts: safeInt(process.env.IAM_SIGNIN_RATE_LIMIT_MAX_ATTEMPTS, 10, 1, 100),
      windowSeconds: safeInt(process.env.IAM_SIGNIN_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });

    if (isIamV2Enabled()) {
      const provider = getIdentityProvider();
      const result = await provider.signIn({
        email: parsed.data.email,
        password: parsed.data.password,
        rememberMe: parsed.data.rememberMe,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      mfaRequired = Boolean(result.mfaRequired);
      if (!mfaRequired) {
        await syncLegacyFromIamSession();
      }
    } else {
      await legacySignIn({
        email: parsed.data.email,
        password: parsed.data.password,
      });
    }
  } catch (error) {
    if (isIamError(error) && error.code === "PASSWORD_RESET_REQUIRED") {
      const email = encodeURIComponent(parsed.data.email.trim().toLowerCase());
      const nextPath = safeNextPath(parsed.data.next);
      const next = nextPath ? `&next=${encodeURIComponent(nextPath)}` : "";
      redirect(`/auth/reset-password?email=${email}${next}`);
    }
    return { error: toActionError(error, ctx.requestId) };
  }

  if (mfaRequired) {
    const nextPath = safeNextPath(parsed.data.next);
    if (nextPath) {
      redirect(`/auth/mfa?required=1&next=${encodeURIComponent(nextPath)}`);
    }
    redirect("/auth/mfa?required=1");
  }

  redirect(safeNextPath(parsed.data.next) ?? "/dashboard");
}

export async function resetPasswordAction(prevState: unknown, formData: FormData) {
  const ctx = await requestContext();
  const parsed = resetPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      error: createValidationAuthActionError(parsed.error.issues[0]?.message ?? "Invalid reset payload", ctx.requestId),
    };
  }

  try {
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        passwordHash: true,
        mustResetPassword: true,
        activeCompanyId: true,
      },
    });
    if (!user) {
      return { error: { code: "UNAUTHORIZED", message: "Invalid credentials", requestId: ctx.requestId } };
    }
    if (!user.mustResetPassword) {
      return {
        error: {
          code: "FORBIDDEN",
          message: "Password reset is not currently required for this account",
          requestId: ctx.requestId,
        },
      };
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return { error: { code: "UNAUTHORIZED", message: "Invalid credentials", requestId: ctx.requestId } };
    }

    const nextHash = await bcrypt.hash(parsed.data.newPassword, 12);
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
      metadata: { passwordResetCompleted: true },
    });
  } catch (error) {
    return { error: toActionError(error, ctx.requestId) };
  }

  const nextPath = safeNextPath(parsed.data.next);
  const next = nextPath ? `&next=${encodeURIComponent(nextPath)}` : "";
  redirect(`/auth/sign-in?passwordReset=1${next}`);
}

export async function sendMagicLinkAction(prevState: unknown, formData: FormData) {
  const ctx = await requestContext();
  const parsed = sendMagicLinkSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: createValidationAuthActionError(parsed.error.issues[0]?.message ?? "Invalid input", ctx.requestId) };
  }

  try {
    await applyAuthAbuseChecks({
      scope: "magic_link_send",
      key: parsed.data.email.trim().toLowerCase(),
      ip: ctx.ip,
      turnstileToken: parsed.data.turnstileToken,
      maxAttempts: safeInt(process.env.IAM_MAGIC_LINK_RATE_LIMIT_MAX_ATTEMPTS, 6, 1, 50),
      windowSeconds: safeInt(process.env.IAM_MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });

    const provider = getIdentityProvider();
    await provider.sendMagicLink({
      email: parsed.data.email,
      redirectTo: parsed.data.redirectTo,
    });
  } catch (error) {
    return { error: toActionError(error, ctx.requestId) };
  }

  return { ok: true };
}

export async function verifyMagicLinkAction(prevState: unknown, formData: FormData) {
  const ctx = await requestContext();
  const parsed = verifyMagicLinkSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: createValidationAuthActionError(parsed.error.issues[0]?.message ?? "Invalid token", ctx.requestId) };
  }

  try {
    await assertRateLimit({
      key: `verify:${ctx.ip ?? "unknown"}`,
      scope: "magic_link_verify",
      maxAttempts: safeInt(process.env.IAM_MAGIC_LINK_VERIFY_RATE_LIMIT_MAX_ATTEMPTS, 20, 1, 200),
      windowSeconds: safeInt(process.env.IAM_MAGIC_LINK_VERIFY_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });

    const provider = getIdentityProvider();
    await provider.verifyMagicLink({ token: parsed.data.token, ip: ctx.ip, userAgent: ctx.userAgent });
    if (isIamV2Enabled()) {
      await syncLegacyFromIamSession();
    }
  } catch (error) {
    if (isIamError(error) && error.code === "PASSWORD_RESET_REQUIRED") {
      redirect("/auth/reset-password");
    }
    return { error: toActionError(error, ctx.requestId) };
  }

  redirect("/dashboard");
}

export async function enrollMfaAction(prevState: unknown, formData: FormData) {
  const ctx = await requestContext();
  const parsed = mfaEnrollSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: createValidationAuthActionError(parsed.error.issues[0]?.message ?? "Invalid input", ctx.requestId) };
  }

  try {
    const principal = await requireAuth({ allowMfaPending: true });
    const provider = getIdentityProvider();

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

    const enrolled = await provider.enrollMfa({
      userId: principal.userId,
      label: parsed.data.label,
    });

    return { ok: true, data: enrolled };
  } catch (error) {
    return { error: toActionError(error, ctx.requestId) };
  }
}

export async function verifyMfaAction(prevState: unknown, formData: FormData) {
  const ctx = await requestContext();
  const parsed = mfaVerifySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: createValidationAuthActionError(parsed.error.issues[0]?.message ?? "Invalid code", ctx.requestId) };
  }

  try {
    const principal = await requireAuth({ allowMfaPending: true });
    const provider = getIdentityProvider();

    await assertRateLimit({
      scope: "mfa_verify_user",
      key: principal.userId,
      maxAttempts: safeInt(process.env.IAM_MFA_VERIFY_RATE_LIMIT_MAX_ATTEMPTS, 10, 1, 100),
      windowSeconds: safeInt(process.env.IAM_MFA_VERIFY_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });
    await assertRateLimit({
      scope: "mfa_verify_ip",
      key: ctx.ip ?? "unknown",
      maxAttempts: safeInt(process.env.IAM_MFA_VERIFY_IP_RATE_LIMIT_MAX_ATTEMPTS, 40, 1, 500),
      windowSeconds: safeInt(process.env.IAM_MFA_VERIFY_IP_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });

    await provider.verifyMfa({
      userId: principal.userId,
      code: parsed.data.code,
    });
    if (isIamV2Enabled()) {
      await syncLegacyFromIamSession();
    }
  } catch (error) {
    return { error: toActionError(error, ctx.requestId) };
  }

  redirect(safeNextPath(parsed.data.next) ?? "/dashboard");
}

export async function verifyMfaRecoveryAction(prevState: unknown, formData: FormData) {
  const ctx = await requestContext();
  const parsed = mfaRecoveryVerifySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      error: createValidationAuthActionError(parsed.error.issues[0]?.message ?? "Invalid recovery code", ctx.requestId),
    };
  }

  const next = safeNextPath(formData.get("next"));

  try {
    const principal = await requireAuth({ allowMfaPending: true });
    const provider = getIdentityProvider();

    await assertRateLimit({
      scope: "mfa_recovery_user",
      key: principal.userId,
      maxAttempts: safeInt(process.env.IAM_MFA_RECOVERY_RATE_LIMIT_MAX_ATTEMPTS, 6, 1, 100),
      windowSeconds: safeInt(process.env.IAM_MFA_RECOVERY_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });
    await assertRateLimit({
      scope: "mfa_recovery_ip",
      key: ctx.ip ?? "unknown",
      maxAttempts: safeInt(process.env.IAM_MFA_RECOVERY_IP_RATE_LIMIT_MAX_ATTEMPTS, 20, 1, 500),
      windowSeconds: safeInt(process.env.IAM_MFA_RECOVERY_IP_RATE_LIMIT_WINDOW_SECONDS, 60, 10, 3600),
    });

    await provider.verifyRecoveryCode({
      userId: principal.userId,
      code: parsed.data.code,
    });
    if (isIamV2Enabled()) {
      await syncLegacyFromIamSession();
    }
  } catch (error) {
    return { error: toActionError(error, ctx.requestId) };
  }

  redirect(next ?? "/dashboard");
}

export async function revokeSessionAction(prevState: unknown, formData: FormData) {
  const ctx = await requestContext();
  const parsed = sessionRevokeSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: createValidationAuthActionError(parsed.error.issues[0]?.message ?? "Invalid session", ctx.requestId) };
  }

  try {
    const principal = await requireAuth();
    const provider = getIdentityProvider();
    await provider.revokeSession(parsed.data.sessionId, principal.userId);
  } catch (error) {
    return { error: toActionError(error, ctx.requestId) };
  }

  return { ok: true };
}

export async function revokeAllSessionsAction() {
  const principal = await requireAuth();
  await requireStepUp();
  const provider = getIdentityProvider();
  await provider.revokeAllSessionsForUser(principal.userId, principal.userId);
  redirect("/auth/sign-in?signedOut=1");
}

export async function logout() {
  await deleteSession();
  redirect("/auth/sign-in");
}

// Backward-compatible names expected by existing pages/components
export const signInAction = signin;
export const signUpAction = signup;
