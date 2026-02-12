import { describe, expect, it } from "vitest";
import { hasInventoryPermission, mapUserRoleToInventoryRole } from "@/modules/inventory/application/policy";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { defaultWorkflowConfig, findTransition } from "@/modules/inventory/domain/workflow";

describe("workflow transitions + permissions", () => {
  it("maps ADMIN to COMPANY_ADMIN and grants posting", () => {
    const role = mapUserRoleToInventoryRole("ADMIN");
    expect(role).toBe("COMPANY_ADMIN");
    expect(hasInventoryPermission(role, inventoryPermissions.documentPost)).toBe(true);
  });

  it("maps OWNER to COMPANY_OWNER and grants settings write", () => {
    const role = mapUserRoleToInventoryRole("OWNER");
    expect(role).toBe("COMPANY_OWNER");
    expect(hasInventoryPermission(role, inventoryPermissions.settingsWrite)).toBe(true);
  });

  it("blocks viewer from posting", () => {
    const role = mapUserRoleToInventoryRole("VIEWER");
    expect(hasInventoryPermission(role, inventoryPermissions.documentPost)).toBe(false);
  });

  it("resolves valid transition from DRAFT -> SUBMITTED", () => {
    const config = defaultWorkflowConfig();
    const transition = findTransition(config, "SUBMIT", "DRAFT", 0);
    expect(transition?.to).toBe("SUBMITTED");
  });

  it("returns null for invalid transition", () => {
    const config = defaultWorkflowConfig();
    const transition = findTransition(config, "POST", "DRAFT", 0);
    expect(transition).toBeNull();
  });
});
