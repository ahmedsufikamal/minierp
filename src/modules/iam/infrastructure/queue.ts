import { Queue } from "bullmq";

export const IAM_QUEUE_NAME = process.env.IAM_QUEUE_NAME ?? "iam-notifications";

export interface QueueJob<T = unknown> {
  name: string;
  payload: T;
  attempts?: number;
  backoffMs?: number;
}

export interface JobQueue {
  provider: "inline" | "bullmq";
  enqueue<T>(job: QueueJob<T>): Promise<void>;
}

type InlineProcessor = (job: QueueJob<unknown>) => Promise<void>;

let inlineProcessor: InlineProcessor | null = null;

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

class InlineJobQueue implements JobQueue {
  readonly provider = "inline" as const;

  async enqueue<T>(job: QueueJob<T>): Promise<void> {
    if (!inlineProcessor) return;
    await inlineProcessor(job as QueueJob<unknown>);
  }
}

class BullMqJobQueue implements JobQueue {
  readonly provider = "bullmq" as const;
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue(IAM_QUEUE_NAME, {
      connection: parseRedisConnection(redisUrl),
      defaultJobOptions: {
        attempts: safeInt(process.env.IAM_QUEUE_DEFAULT_ATTEMPTS, 4, 1, 25),
        backoff: {
          type: "exponential",
          delay: safeInt(process.env.IAM_QUEUE_DEFAULT_BACKOFF_MS, 1_000, 100, 60_000),
        },
        removeOnComplete: { count: safeInt(process.env.IAM_QUEUE_REMOVE_ON_COMPLETE, 1_000, 10, 50_000) },
        removeOnFail: { count: safeInt(process.env.IAM_QUEUE_REMOVE_ON_FAIL, 5_000, 10, 100_000) },
      },
    });
  }

  async enqueue<T>(job: QueueJob<T>): Promise<void> {
    await this.queue.add(job.name, job.payload as Record<string, unknown>, {
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

let queueInstance: JobQueue | null = null;

export function registerIamInlineProcessor(processor: InlineProcessor) {
  inlineProcessor = processor;
}

function shouldUseBullMq(): boolean {
  const provider = (process.env.IAM_QUEUE_PROVIDER ?? "inline").toLowerCase();
  return provider === "bullmq";
}

export function getIamQueue(): JobQueue {
  if (queueInstance) return queueInstance;

  if (shouldUseBullMq()) {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      queueInstance = new BullMqJobQueue(redisUrl);
      return queueInstance;
    }
  }

  queueInstance = new InlineJobQueue();
  return queueInstance;
}
