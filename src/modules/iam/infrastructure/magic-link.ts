import { prisma } from "@/lib/prisma";
import { getRequiredAppBaseUrl } from "@/lib/runtime-env";
import { IamError } from "@/modules/iam/domain/errors";
import { hashToken, randomToken } from "@/modules/iam/infrastructure/crypto";
import { getNotificationService } from "@/modules/iam/infrastructure/notifications";

const MAGIC_LINK_TTL_MINUTES = 15;

export async function sendMagicLink(input: {
  email: string;
  redirectTo?: string;
  companyName?: string;
  logoUrl?: string | null;
}): Promise<void> {
  const token = randomToken(32);
  const tokenHash = hashToken(token);

  const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });

  await prisma.iamMagicLinkToken.create({
    data: {
      userId: user?.id ?? null,
      email: input.email,
      purpose: "SIGN_IN",
      tokenHash,
      expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000),
    },
  });

  const baseUrl = getRequiredAppBaseUrl();
  const url = new URL("/auth/verify", baseUrl);
  url.searchParams.set("type", "magic-link");
  url.searchParams.set("token", token);
  if (input.redirectTo) url.searchParams.set("redirectTo", input.redirectTo);

  await getNotificationService().sendMagicLinkEmail({
    to: input.email,
    magicLinkUrl: url.toString(),
    logoUrl: input.logoUrl,
  });
}

export async function consumeMagicLink(token: string): Promise<{ userId: string }> {
  const tokenHash = hashToken(token);
  const row = await prisma.iamMagicLinkToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, email: true, expiresAt: true, consumedAt: true },
  });

  if (!row) throw new IamError("TOKEN_INVALID", "Magic link is invalid");
  if (row.consumedAt) throw new IamError("TOKEN_INVALID", "Magic link already used");
  if (row.expiresAt <= new Date()) throw new IamError("TOKEN_EXPIRED", "Magic link has expired");

  const user = row.userId
    ? await prisma.user.findUnique({ where: { id: row.userId }, select: { id: true } })
    : await prisma.user.findUnique({ where: { email: row.email }, select: { id: true } });

  if (!user) {
    throw new IamError("NOT_FOUND", "No user account for this magic link");
  }

  await prisma.iamMagicLinkToken.update({ where: { id: row.id }, data: { consumedAt: new Date(), userId: user.id } });

  return { userId: user.id };
}
