import { describe, expect, it } from "vitest";

import { flatNavItems, navGroups, primaryNavItem } from "@/components/shell/nav";

describe("shell nav", () => {
  it("defines dashboard as standalone primary nav item", () => {
    expect(primaryNavItem.href).toBe("/dashboard");
    expect(primaryNavItem.label).toBe("Dashboard");
  });

  it("does not include dashboard inside grouped nav sections", () => {
    const dashboardInsideGroups = navGroups.some((group) =>
      group.items.some((item) => item.href === "/dashboard"),
    );
    expect(dashboardInsideGroups).toBe(false);
  });

  it("keeps dashboard first and unique in flattened nav items", () => {
    const dashboardItems = flatNavItems.filter((item) => item.href === "/dashboard");

    expect(dashboardItems).toHaveLength(1);
    expect(flatNavItems[0]?.href).toBe("/dashboard");
  });
});
