import { Queue } from "bullmq";

export const INVENTORY_QUEUE_NAME = process.env.INVENTORY_QUEUE_NAME ?? "inventory-ops";

export interface InventoryQueueJob<T = unknown> {
  name: "inventory:repost" | "inventory:stock-closing" | "inventory:outbox-relay";
  payload: T;
  attempts?: number;
  backoffMs?: number;
  jobId?: string;
}

export interface InventoryJobQueue {
  provider: "inline" | "bullmq";
  enqueue<T>(job: InventoryQueueJob<T>): Promise<void>;
}

type InlineProcessor = (job: InventoryQueueJob<unknown>) => Promise<void>;

let inlineProcessor: InlineProcessor | null = null;
let queueInstance: InventoryJobQueue | null = null;

function safeInt(value: string | undefined, fallback: number, min = 1, max = 10_000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function parseRedisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number(url.pathname.replace("/", "") || 0),
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null as number | null,
  };
}

class InlineQueue implements InventoryJobQueue {
  readonly provider = "inline" as const;

  async enqueue<T>(job: InventoryQueueJob<T>): Promise<void> {
    if (!inlineProcessor) return;
    await inlineProcessor(job as InventoryQueueJob<unknown>);
  }
}

class BullMqQueue implements InventoryJobQueue {
  readonly provider = "bullmq" as const;
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue(INVENTORY_QUEUE_NAME, {
      connection: parseRedisConnection(redisUrl),
      defaultJobOptions: {
        attempts: safeInt(process.env.INVENTORY_QUEUE_DEFAULT_ATTEMPTS, 5, 1, 50),
        backoff: {
          type: "exponential",
          delay: safeInt(process.env.INVENTORY_QUEUE_DEFAULT_BACKOFF_MS, 1_000, 100, 120_000),
        },
        removeOnComplete: { count: safeInt(process.env.INVENTORY_QUEUE_REMOVE_ON_COMPLETE, 1_000, 10, 50_000) },
        removeOnFail: { count: safeInt(process.env.INVENTORY_QUEUE_REMOVE_ON_FAIL, 5_000, 10, 100_000) },
      },
    });
  }

  async enqueue<T>(job: InventoryQueueJob<T>): Promise<void> {
    await this.queue.add(job.name, job.payload as Record<string, unknown>, {
      jobId: job.jobId,
      attempts: job.attempts,
      backoff: job.backoffMs
        ? {
            type: "exponential",
            delay: job.backoffMs,
          }
        : undefined,
    });
  }
}

function shouldUseBullMq(): boolean {
  return (process.env.INVENTORY_QUEUE_PROVIDER ?? "inline").toLowerCase() === "bullmq";
}

export function registerInventoryInlineProcessor(processor: InlineProcessor): void {
  inlineProcessor = processor;
}

export function getInventoryOpsQueue(): InventoryJobQueue {
  if (queueInstance) return queueInstance;

  if (shouldUseBullMq()) {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      queueInstance = new BullMqQueue(redisUrl);
      return queueInstance;
    }
  }

  queueInstance = new InlineQueue();
  return queueInstance;
}

