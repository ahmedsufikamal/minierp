import { describe, expect, it } from "vitest";
import {
  flattenShellNavItems,
  formatModuleSubtext,
  resolveActiveModule,
  shellModules,
} from "@/components/shell/shell-config";
import { normalizeSidebarCollapsed } from "@/components/shell/sidebar-state";

describe("shell configuration", () => {
  it("resolves the active module from the pathname", () => {
    expect(resolveActiveModule("/stock/items").id).toBe("stock");
    expect(resolveActiveModule("/admin/users").id).toBe("workspace");
    expect(resolveActiveModule("/ops/inbox").id).toBe("operations");
    expect(resolveActiveModule("/unknown").id).toBe("stock");
  });

  it("keeps flattened nav items unique by href and excludes non-clickable parents", () => {
    const items = flattenShellNavItems();
    const dashboardItems = items.filter((item) => item.href === "/dashboard");
    const opsInboxItems = items.filter((item) => item.href === "/ops/inbox");

    expect(dashboardItems).toHaveLength(1);
    expect(opsInboxItems).toHaveLength(1);
    expect(items.some((item) => item.label === "Tools")).toBe(false);
  });

  it("builds the stock module navigation in the requested order", () => {
    const stockModule = shellModules.find((module) => module.id === "stock");

    expect(stockModule?.sections.map((section) => section.items.map((item) => item.label))).toEqual(
      [
        ["Stock Entry", "Purchase Receipt", "Delivery Note", "Material Request", "Pick List"],
        ["Tools", "Setup", "Reports", "Settings"],
      ],
    );
    expect(stockModule?.sections[1]?.items[0]?.children?.map((item) => item.label)).toEqual([
      "Stock Reconciliation",
      "Landed Cost Voucher",
      "Repost Item Valuation",
      "Packing Slip",
      "Quality Inspection",
    ]);
  });

  it("formats module subtext with company label first", () => {
    expect(
      formatModuleSubtext({ companyLabel: "Workspace Alpha", email: "person@example.com" }),
    ).toBe("Workspace Alpha");
    expect(formatModuleSubtext({ email: "person@example.com" })).toBe("person@example.com");
  });

  it("normalizes stored sidebar state", () => {
    expect(normalizeSidebarCollapsed("1")).toBe(true);
    expect(normalizeSidebarCollapsed("true")).toBe(true);
    expect(normalizeSidebarCollapsed("0")).toBe(false);
    expect(normalizeSidebarCollapsed(null)).toBe(false);
  });
});
