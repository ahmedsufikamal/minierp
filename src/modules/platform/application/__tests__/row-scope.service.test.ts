import { describe, expect, it } from "vitest";
import { assertRowScope, parseSelector } from "@/modules/platform/application/row-scope.service";

describe("row scope service", () => {
  it("parses selector arrays and normalizes values", () => {
    const selector = parseSelector({
      companyIds: ["c1", "c2"],
      warehouseIds: ["w1"],
      projectIds: ["p1", "p2"],
    });

    expect(selector.companyIds).toEqual(["c1", "c2"]);
    expect(selector.warehouseIds).toEqual(["w1"]);
    expect(selector.projectIds).toEqual(["p1", "p2"]);
  });

  it("bypasses scope checks for super admin", async () => {
    await expect(
      assertRowScope(
        {
          requestId: "req-1",
          tenantId: "tenant-a",
          companyId: "company-a",
          userId: "user-a",
          role: "OWNER",
          platformRole: "SUPER_ADMIN",
          permissions: [],
        },
        "inventory.document",
        {
          tenantId: "tenant-b",
          companyId: "company-b",
        },
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects cross-tenant access before DB lookups", async () => {
    await expect(
      assertRowScope(
        {
          requestId: "req-1",
          tenantId: "tenant-a",
          companyId: "company-a",
          userId: "user-a",
          role: "MANAGER",
          platformRole: "NONE",
          permissions: [],
        },
        "inventory.document",
        {
          tenantId: "tenant-b",
        },
      ),
    ).rejects.toThrowError(/cross-tenant access denied/i);
  });
});
