"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getIdentityProvider } from "@/modules/iam/infrastructure/provider";
import { createSession, deleteSession } from "@/lib/session";
import {
  sendMagicLinkSchema,
  mfaEnrollSchema,
  mfaVerifySchema,
  sessionRevokeSchema,
  signInSchema,
  signUpSchema,
  verifyMagicLinkSchema,
} from "@/modules/iam/interface/schemas";
import { requireAuth } from "@/modules/iam";
import { IamError, isIamError } from "@/modules/iam/domain/errors";

function isIamV2Enabled(): boolean {
  return process.env.IAM_V2_ENABLED === "1";
}

function isSchemaMismatch(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function toActionErrorMessage(error: unknown): string {
  if (isIamError(error)) return error.message;
  if (isSchemaMismatch(error)) {
    return "IAM database schema is outdated. Run prisma migrations and seed.";
  }
  if (error instanceof Error) return error.message;
  return "Unexpected authentication error";
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
  return { ip: ip ?? null, userAgent: userAgent ?? null };
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

export async function signup(prevState: unknown, formData: FormData) {
  const parsed = signUpSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const provider = getIdentityProvider();
  const ctx = await requestContext();
  await provider.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    name: parsed.data.name,
    companyName: parsed.data.companyName,
    companySlug: parsed.data.companySlug,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  redirect("/dashboard");
}

export async function signin(prevState: unknown, formData: FormData) {
  const parsed = signInSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let mfaRequired = false;
  try {
    if (isIamV2Enabled()) {
      const provider = getIdentityProvider();
      const ctx = await requestContext();
      const result = await provider.signIn({
        email: parsed.data.email,
        password: parsed.data.password,
        rememberMe: parsed.data.rememberMe,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      mfaRequired = Boolean(result.mfaRequired);
    } else {
      await legacySignIn({
        email: parsed.data.email,
        password: parsed.data.password,
      });
    }
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }

  if (mfaRequired) {
    redirect("/auth/mfa?required=1");
  }

  redirect("/dashboard");
}

export async function sendMagicLinkAction(prevState: unknown, formData: FormData) {
  const parsed = sendMagicLinkSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const provider = getIdentityProvider();
  await provider.sendMagicLink({
    email: parsed.data.email,
    redirectTo: parsed.data.redirectTo,
  });

  return { ok: true };
}

export async function verifyMagicLinkAction(prevState: unknown, formData: FormData) {
  const parsed = verifyMagicLinkSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid token" };
  }

  const provider = getIdentityProvider();
  const ctx = await requestContext();
  await provider.verifyMagicLink({ token: parsed.data.token, ip: ctx.ip, userAgent: ctx.userAgent });
  redirect("/dashboard");
}

export async function enrollMfaAction(prevState: unknown, formData: FormData) {
  const parsed = mfaEnrollSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const principal = await requireAuth();
  const provider = getIdentityProvider();
  const enrolled = await provider.enrollMfa({
    userId: principal.userId,
    label: parsed.data.label,
  });

  return { ok: true, data: enrolled };
}

export async function verifyMfaAction(prevState: unknown, formData: FormData) {
  const parsed = mfaVerifySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid code" };
  }

  const principal = await requireAuth();
  const provider = getIdentityProvider();
  await provider.verifyMfa({
    userId: principal.userId,
    code: parsed.data.code,
  });

  return { ok: true };
}

export async function revokeSessionAction(prevState: unknown, formData: FormData) {
  const parsed = sessionRevokeSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid session" };
  }

  const principal = await requireAuth();
  const provider = getIdentityProvider();
  await provider.revokeSession(parsed.data.sessionId, principal.userId);

  return { ok: true };
}

export async function revokeAllSessionsAction() {
  const principal = await requireAuth();
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
