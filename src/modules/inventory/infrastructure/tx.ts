import { Prisma } from "@prisma/client";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isSerializableConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma transaction conflict/serialization failure.
    if (error.code === "P2034") return true;
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("could not serialize access due to concurrent update") ||
    message.includes("serialization failure") ||
    message.includes("SQLSTATE 40001")
  );
}

export async function withSerializableRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 40;
  const maxDelayMs = options?.maxDelayMs ?? 300;

  let attempt = 0;
  while (true) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (!isSerializableConflict(error) || attempt >= maxRetries) {
        throw error;
      }

      const exp = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const jitter = Math.floor(Math.random() * Math.max(5, Math.floor(exp / 2)));
      await sleep(exp + jitter);
      attempt += 1;
    }
  }
}

export function stockScopeAdvisoryKey(params: {
  companyId: string;
  itemId: string;
  warehouseId: string;
  locationId: string | null;
}): string {
  return `${params.companyId}::${params.itemId}::${params.warehouseId}::${params.locationId ?? "~"}`;
}

export async function advisoryLockInventoryScopeInTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    itemId: string;
    warehouseId: string;
    locationId: string | null;
  },
): Promise<void> {
  const key = stockScopeAdvisoryKey(params);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0));`;
}
