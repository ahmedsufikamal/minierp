import { describe, expect, it } from "vitest";
import { PlatformError } from "@/modules/platform/domain/errors";
import { assertMasterAdminOwner } from "@/modules/platform/application/company-numbering.service";

describe("company numbering governance", () => {
  it("allows OWNER role to manage numbering", () => {
    expect(() =>
      assertMasterAdminOwner({
        requestId: "req-1",
        tenantId: "tenant-1",
        companyId: "company-1",
        userId: "user-1",
        role: "OWNER",
        platformRole: "NONE",
        permissions: [],
      }),
    ).not.toThrow();
  });

  it("rejects non-owner roles", () => {
    expect(() =>
      assertMasterAdminOwner({
        requestId: "req-1",
        tenantId: "tenant-1",
        companyId: "company-1",
        userId: "user-1",
        role: "ADMIN",
        platformRole: "NONE",
        permissions: [],
      }),
    ).toThrowError(PlatformError);
  });
});
