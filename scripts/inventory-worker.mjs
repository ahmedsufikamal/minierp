import { Worker } from "bullmq";

const queueName = process.env.INVENTORY_QUEUE_NAME || "inventory-ops";
const redisUrl = process.env.REDIS_URL;
const workerToken = process.env.INVENTORY_WORKER_TOKEN;
const apiBaseUrl =
  (process.env.INVENTORY_WORKER_API_BASE_URL || process.env.APP_BASE_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    "",
  );

if (!redisUrl) {
  console.error("REDIS_URL is required for inventory worker.");
  process.exit(1);
}

if (!workerToken) {
  console.error("INVENTORY_WORKER_TOKEN is required for inventory worker.");
  process.exit(1);
}

function parseRedisConnection(urlValue) {
  const url = new URL(urlValue);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number(url.pathname.replace("/", "") || 0),
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

async function processJob(name, data, jobId) {
  if (
    name !== "inventory:repost" &&
    name !== "inventory:stock-closing" &&
    name !== "inventory:outbox-relay"
  ) {
    throw new Error(`Unknown inventory job: ${name}`);
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/inventory/admin/jobs/process`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-inventory-worker-token": workerToken,
    },
    body: JSON.stringify({
      jobId: data?.jobId || jobId,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || `Inventory job processing failed (${response.status})`;
    throw new Error(message);
  }
}

const worker = new Worker(
  queueName,
  async (job) => {
    await processJob(job.name, job.data, String(job.id));
  },
  {
    connection: parseRedisConnection(redisUrl),
    concurrency: Math.max(1, Number(process.env.INVENTORY_QUEUE_CONCURRENCY || 5)),
  },
);

worker.on("ready", () => {
  console.log(`[inventory-worker] Listening on queue "${queueName}"`);
});

worker.on("failed", (job, error) => {
  console.error(`[inventory-worker] Job failed: ${job?.name} (${job?.id})`, error);
});

worker.on("completed", (job) => {
  if (process.env.INVENTORY_WORKER_VERBOSE === "1") {
    console.log(`[inventory-worker] Job completed: ${job.name} (${job.id})`);
  }
});

async function shutdown(signal) {
  console.log(`[inventory-worker] Received ${signal}, shutting down...`);
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

