export type QueueCapability = {
  enabled: boolean;
  provider: "bullmq" | "inline";
};

let cached: QueueCapability | null = null;

export async function detectQueueCapability(): Promise<QueueCapability> {
  if (cached) return cached;

  if (!process.env.REDIS_URL) {
    cached = { enabled: false, provider: "inline" };
    return cached;
  }

  try {
    await import("bullmq");
    cached = { enabled: true, provider: "bullmq" };
    return cached;
  } catch {
    cached = { enabled: false, provider: "inline" };
    return cached;
  }
}
