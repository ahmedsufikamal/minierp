import { logInfo } from "@/lib/logger";

export type CompiledMetaCacheValue = {
  etag: string;
  payload: Record<string, unknown>;
};

type CacheEntry = {
  expiresAt: number;
  value: CompiledMetaCacheValue;
};

const cache = new Map<string, CacheEntry>();

function ttlMs(): number {
  const raw = Number.parseInt(process.env.META_COMPILED_CACHE_TTL_MS ?? "300000", 10);
  if (!Number.isFinite(raw) || raw < 5_000) return 300_000;
  return raw;
}

function toKey(input: { tenantId: string; companyId: string; modelName: string; version: number }): string {
  return `${input.tenantId}:${input.companyId}:${input.modelName}:${input.version}`;
}

export function getCompiledMetaCache(input: {
  tenantId: string;
  companyId: string;
  modelName: string;
  version: number;
}): CompiledMetaCacheValue | null {
  const key = toKey(input);
  const row = cache.get(key);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return row.value;
}

export function setCompiledMetaCache(
  input: {
    tenantId: string;
    companyId: string;
    modelName: string;
    version: number;
  },
  value: CompiledMetaCacheValue,
): void {
  cache.set(toKey(input), {
    expiresAt: Date.now() + ttlMs(),
    value,
  });
}

export function invalidateCompiledMetaCache(input: {
  tenantId: string;
  companyId: string;
  modelName: string;
}): void {
  const prefix = `${input.tenantId}:${input.companyId}:${input.modelName}:`;
  let removed = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      removed += 1;
    }
  }
  if (removed > 0) {
    logInfo("meta cache invalidated", {
      module: "platform.meta-cache",
      details: { modelName: input.modelName, removed },
    });
  }
}
