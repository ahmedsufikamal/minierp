import { prisma } from "@/lib/prisma";
import { IamError } from "@/modules/iam/domain/errors";
import crypto from "node:crypto";

const localWindow = new Map<string, { count: number; resetAt: number }>();

export async function assertRateLimit(input: {
  key: string;
  scope: string;
  maxAttempts: number;
  windowSeconds: number;
}): Promise<void> {
  const bucket = `${input.scope}:${crypto.createHash("sha256").update(input.key).digest("hex")}`;
  const mode = process.env.IAM_RATE_LIMIT_MODE ?? (process.env.NODE_ENV === "production" ? "db" : "memory");

  if (mode === "db") {
    const since = new Date(Date.now() - input.windowSeconds * 1000);
    const count = await prisma.iamLoginAttempt.count({
      where: {
        reasonCode: `RATE_LIMIT:${bucket}`,
        createdAt: { gte: since },
      },
    });
    if (count >= input.maxAttempts) {
      throw new IamError("RATE_LIMITED", "Too many attempts, try again later");
    }

    await prisma.iamLoginAttempt.create({
      data: {
        result: "RATE_LIMIT_CHECK",
        reasonCode: `RATE_LIMIT:${bucket}`,
      },
    });
    return;
  }

  const now = Date.now();
  const slot = localWindow.get(bucket);
  if (!slot || slot.resetAt <= now) {
    localWindow.set(bucket, { count: 1, resetAt: now + input.windowSeconds * 1000 });
    return;
  }

  if (slot.count >= input.maxAttempts) {
    throw new IamError("RATE_LIMITED", "Too many attempts, try again later");
  }

  slot.count += 1;
}
