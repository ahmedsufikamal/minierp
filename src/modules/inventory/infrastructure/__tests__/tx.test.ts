import { describe, expect, it, vi } from "vitest";
import {
  advisoryLockInventoryScopeInTx,
  isSerializableConflict,
  stockScopeAdvisoryKey,
  withSerializableRetry,
} from "@/modules/inventory/infrastructure/tx";

function serializationError() {
  return new Error("SQLSTATE 40001: could not serialize access due to concurrent update");
}

describe("inventory tx helpers", () => {
  it("withSerializableRetry retries serialization failures and succeeds", async () => {
    const fn = vi
      .fn<Parameters<typeof withSerializableRetry<"ok">>[0]>()
      .mockRejectedValueOnce(serializationError())
      .mockRejectedValueOnce(serializationError())
      .mockResolvedValue("ok");

    const result = await withSerializableRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 1,
      maxDelayMs: 2,
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("withSerializableRetry stops deterministically at max retries", async () => {
    const fn = vi.fn().mockRejectedValue(serializationError());

    await expect(
      withSerializableRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 2,
      }),
    ).rejects.toThrow(/40001|serialize/i);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("detects serialization conflict messages", () => {
    expect(isSerializableConflict(serializationError())).toBe(true);
    expect(isSerializableConflict(new Error("other db error"))).toBe(false);
  });

  it("advisory lock key generation is stable and location-null-safe", () => {
    const a = stockScopeAdvisoryKey({
      companyId: "c1",
      itemId: "i1",
      warehouseId: "w1",
      locationId: null,
    });
    const b = stockScopeAdvisoryKey({
      companyId: "c1",
      itemId: "i1",
      warehouseId: "w1",
      locationId: null,
    });
    const c = stockScopeAdvisoryKey({
      companyId: "c1",
      itemId: "i1",
      warehouseId: "w1",
      locationId: "loc-1",
    });

    expect(a).toBe("c1::i1::w1::~");
    expect(a).toBe(b);
    expect(c).toBe("c1::i1::w1::loc-1");
    expect(c).not.toBe(a);
  });

  it("acquires advisory locks without deserializing a raw result", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
    };

    await advisoryLockInventoryScopeInTx(tx as never, {
      companyId: "c1",
      itemId: "i1",
      warehouseId: "w1",
      locationId: null,
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
