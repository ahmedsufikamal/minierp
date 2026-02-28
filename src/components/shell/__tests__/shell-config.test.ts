import { describe, expect, it } from "vitest";
import { flattenShellNavItems, formatModuleSubtext, resolveActiveModule } from "@/components/shell/shell-config";
import { normalizeSidebarCollapsed } from "@/components/shell/sidebar-state";

describe("shell configuration", () => {
  it("resolves the active module from the pathname", () => {
    expect(resolveActiveModule("/stock/items").id).toBe("stock");
    expect(resolveActiveModule("/admin/users").id).toBe("workspace");
    expect(resolveActiveModule("/unknown").id).toBe("stock");
  });

  it("keeps flattened nav items unique by href", () => {
    const items = flattenShellNavItems();
    const dashboardItems = items.filter((item) => item.href === "/dashboard");

    expect(dashboardItems).toHaveLength(1);
  });

  it("formats module subtext with company label first", () => {
    expect(formatModuleSubtext({ companyLabel: "Workspace Alpha", email: "person@example.com" })).toBe("Workspace Alpha");
    expect(formatModuleSubtext({ email: "person@example.com" })).toBe("person@example.com");
  });

  it("normalizes stored sidebar state", () => {
    expect(normalizeSidebarCollapsed("1")).toBe(true);
    expect(normalizeSidebarCollapsed("true")).toBe(true);
    expect(normalizeSidebarCollapsed("0")).toBe(false);
    expect(normalizeSidebarCollapsed(null)).toBe(false);
  });
});
