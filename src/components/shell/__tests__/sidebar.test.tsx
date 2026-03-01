import { describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Sidebar } from "@/components/shell/sidebar";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { shellModules } from "@/components/shell/shell-config";

let mockPathname = "/stock";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/minierp-logo", () => ({
  MiniERPLogo: () => <div>miniERP</div>,
}));

vi.mock("@/components/shell/module-switcher", () => ({
  ModuleSwitcher: () => <div>Module Switcher</div>,
}));

vi.mock("@/components/shell/user-chip-menu", () => ({
  UserChipMenu: () => <div>User Menu</div>,
}));

describe("sidebar rendering", () => {
  it("removes quick access search and notifications from the left sidebar", () => {
    mockPathname = "/stock";

    const html = renderToStaticMarkup(
      <Sidebar collapsed={false} onToggleCollapsed={() => undefined} />,
    );

    expect(html).not.toContain("Search");
    expect(html).not.toContain("Notifications");
  });

  it("renders stock submenu parents as toggle buttons and keeps inactive children hidden", () => {
    const stockSections = shellModules.find((module) => module.id === "stock")?.sections ?? [];
    const html = renderToStaticMarkup(
      <SidebarNav sections={stockSections} pathname="/stock" collapsed={false} />,
    );

    expect(html).toContain('aria-label="Tools"');
    expect(html).toContain('aria-label="Setup"');
    expect(html).toContain('aria-label="Reports"');
    expect(html).toContain('aria-label="Settings"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Stock Reconciliation");
  });

  it("auto-expands the active stock submenu", () => {
    const stockSections = shellModules.find((module) => module.id === "stock")?.sections ?? [];
    const html = renderToStaticMarkup(
      <SidebarNav
        sections={stockSections}
        pathname="/stock/tools/repost-item-valuation"
        collapsed={false}
      />,
    );

    expect(html).toContain('aria-label="Tools"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Repost Item Valuation");
  });
});
