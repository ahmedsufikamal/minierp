import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password must be at most 128 characters")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number")
    .regex(/[^A-Za-z0-9]/, "Password must include a symbol"),
  companyName: z.string().min(2).max(120).optional(),
  companySlug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug can only include lowercase letters, numbers, and dashes")
    .optional(),
  inviteToken: z.string().min(16).optional(),
  next: z.string().optional(),
  turnstileToken: z.string().optional(),
  rememberMe: z.boolean().optional(),
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
  next: z.string().optional(),
  turnstileToken: z.string().optional(),
});

export const sendOtpSchema = z.object({
  destination: z.string().min(3),
  channel: z.enum(["EMAIL", "SMS"]),
  purpose: z.string().min(2),
  turnstileToken: z.string().optional(),
});

export const verifyOtpSchema = z.object({
  destination: z.string().min(3),
  code: z.string().min(4).max(8),
  purpose: z.string().min(2),
});

export const sendMagicLinkSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().optional(),
  turnstileToken: z.string().optional(),
});

export const verifyMagicLinkSchema = z.object({
  token: z.string().min(16),
});

export const mfaEnrollSchema = z.object({
  label: z.string().min(1).max(120).optional(),
});

export const mfaVerifySchema = z.object({
  code: z.string().min(6).max(10),
  next: z.string().optional(),
});

export const createOrgSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
});

export const invitePayloadSchema = z.object({
  email: z.string().email(),
  roleId: z.string().optional().nullable(),
  autoJoinRuleId: z.string().optional().nullable(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(16),
});

export const previewInviteQuerySchema = z.object({
  token: z.string().min(16),
});

export const claimInviteSchema = z.object({
  token: z.string().min(16),
});

export const roleUpsertSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(200).optional().nullable(),
  permissionKeys: z.array(z.string().min(3)).default([]),
});

export const policyConfigSchema = z.object({
  allowedAuthMethods: z.array(z.enum(["PASSWORD", "MAGIC_LINK", "OAUTH_GOOGLE", "OAUTH_MICROSOFT", "OTP_EMAIL", "OTP_SMS"])),
  mfaPolicy: z.object({
    mode: z.enum(["OPTIONAL", "REQUIRED_FOR_ADMINS", "REQUIRED_FOR_ALL"]),
    enforceForRoles: z.array(z.string()),
    allowOtpFallback: z.boolean(),
  }),
  sessionPolicy: z.object({
    idleTimeoutMinutes: z.number().int().min(5).max(24 * 60),
    absoluteTimeoutMinutes: z.number().int().min(30).max(30 * 24 * 60),
    rememberMeAbsoluteTimeoutMinutes: z.number().int().min(60).max(180 * 24 * 60),
    rotateEveryMinutes: z.number().int().min(5).max(24 * 60),
  }),
  botProtectionPolicy: z.object({
    turnstileEnabled: z.boolean(),
    rateLimitWindowSeconds: z.number().int().min(10).max(3600),
    rateLimitMaxAttempts: z.number().int().min(1).max(100),
  }),
});

export const sessionRevokeSchema = z.object({
  sessionId: z.string().min(1),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type SendMagicLinkInput = z.infer<typeof sendMagicLinkSchema>;
export type VerifyMagicLinkInput = z.infer<typeof verifyMagicLinkSchema>;
export type InvitePayload = z.infer<typeof invitePayloadSchema>;
export type ClaimInviteInput = z.infer<typeof claimInviteSchema>;
export type RoleUpsertInput = z.infer<typeof roleUpsertSchema>;
export type PolicyConfigInput = z.infer<typeof policyConfigSchema>;
