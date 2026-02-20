import { describe, expect, it } from "vitest";
import { computeEventHash, stableStringify } from "@/modules/platform/application/audit-ledger.service";

describe("audit ledger hashing", () => {
  it("stableStringify is deterministic for object key order", () => {
    const a = { b: 2, a: 1, nested: { z: 2, y: 1 } };
    const b = { nested: { y: 1, z: 2 }, a: 1, b: 2 };

    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("computeEventHash changes when previous hash changes", () => {
    const base = {
      tenantId: "t1",
      companyId: "c1",
      stream: "inventory",
      eventType: "POST",
      entityType: "InventoryDocument",
      entityId: "doc-1",
      payload: { qty: 1 },
      previousHash: null,
    };

    const hash1 = computeEventHash(base);
    const hash2 = computeEventHash({ ...base, previousHash: "abc" });

    expect(hash1).not.toBe(hash2);
  });
});
