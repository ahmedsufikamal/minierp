import { prisma } from "@/lib/prisma";
import { IamError } from "@/modules/iam/domain/errors";
import { hashToken, randomNumericCode } from "@/modules/iam/infrastructure/crypto";
import { getNotificationService } from "@/modules/iam/infrastructure/notifications";

const OTP_TTL_SECONDS = 10 * 60;

export async function sendOtp(input: {
  destination: string;
  channel: "EMAIL" | "SMS";
  purpose: string;
  userId?: string;
  companyId?: string;
  ip?: string | null;
  requestId?: string | null;
}): Promise<void> {
  const code = randomNumericCode(6);
  const codeHash = hashToken(`${input.destination}:${input.purpose}:${code}`);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await prisma.iamOtpChallenge.create({
    data: {
      userId: input.userId ?? null,
      companyId: input.companyId ?? null,
      channel: input.channel,
      destination: input.destination,
      purpose: input.purpose,
      codeHash,
      expiresAt,
      ip: input.ip ?? null,
      requestId: input.requestId ?? null,
    },
  });

  const notifications = getNotificationService();
  if (input.channel === "EMAIL") {
    await notifications.sendOtpEmail({ to: input.destination, code, purpose: input.purpose });
  } else {
    await notifications.sendOtpSms({ to: input.destination, code, purpose: input.purpose });
  }
}

export async function verifyOtp(input: { destination: string; code: string; purpose: string }): Promise<void> {
  const challenge = await prisma.iamOtpChallenge.findFirst({
    where: {
      destination: input.destination,
      purpose: input.purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    throw new IamError("TOKEN_INVALID", "OTP challenge not found");
  }
  if (challenge.expiresAt <= new Date()) {
    throw new IamError("TOKEN_EXPIRED", "OTP has expired");
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    throw new IamError("RATE_LIMITED", "Too many OTP attempts");
  }

  const providedHash = hashToken(`${input.destination}:${input.purpose}:${input.code}`);
  if (providedHash !== challenge.codeHash) {
    await prisma.iamOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: challenge.attempts + 1 },
    });
    throw new IamError("TOKEN_INVALID", "Invalid OTP code");
  }

  await prisma.iamOtpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
}
