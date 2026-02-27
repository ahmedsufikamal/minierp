import crypto from "node:crypto";
import { InventoryError } from "@/modules/inventory/domain/errors";

const localWindow = new Map<string, { count: number; resetAt: number }>();

export async function assertInventoryRateLimit(input: {
  key: string;
  scope: string;
  maxAttempts: number;
  windowSeconds: number;
}): Promise<void> {
  const bucket = `${input.scope}:${crypto.createHash("sha256").update(input.key).digest("hex")}`;
  const now = Date.now();
  const slot = localWindow.get(bucket);

  if (!slot || slot.resetAt <= now) {
    localWindow.set(bucket, { count: 1, resetAt: now + input.windowSeconds * 1000 });
    return;
  }

  if (slot.count >= input.maxAttempts) {
    throw new InventoryError("RATE_LIMITED", "Too many requests, try again later");
  }

  slot.count += 1;
}

