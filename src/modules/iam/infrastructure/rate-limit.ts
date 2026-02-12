import { prisma } from "@/lib/prisma";
import { IamError } from "@/modules/iam/domain/errors";

const localWindow = new Map<string, { count: number; resetAt: number }>();

export async function assertRateLimit(input: {
  key: string;
  scope: string;
  maxAttempts: number;
  windowSeconds: number;
}): Promise<void> {
  if (process.env.IAM_RATE_LIMIT_MODE === "db") {
    const since = new Date(Date.now() - input.windowSeconds * 1000);
    const count = await prisma.iamLoginAttempt.count({
      where: {
        reasonCode: `${input.scope}:${input.key}`,
        createdAt: { gte: since },
      },
    });
    if (count >= input.maxAttempts) {
      throw new IamError("RATE_LIMITED", "Too many attempts, try again later");
    }
    return;
  }

  const now = Date.now();
  const slot = localWindow.get(input.key);
  if (!slot || slot.resetAt <= now) {
    localWindow.set(input.key, { count: 1, resetAt: now + input.windowSeconds * 1000 });
    return;
  }

  if (slot.count >= input.maxAttempts) {
    throw new IamError("RATE_LIMITED", "Too many attempts, try again later");
  }

  slot.count += 1;
}
