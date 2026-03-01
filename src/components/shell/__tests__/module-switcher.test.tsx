import { describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleSwitcher } from "@/components/shell/module-switcher";
import { shellModules } from "@/components/shell/shell-config";

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

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
}));

vi.mock("@/components/minierp-logo", () => ({
  MiniERPLogo: () => <div>miniERP</div>,
}));

describe("module switcher", () => {
  it("renders module entries as links to each module homeHref", () => {
    const activeModule = shellModules.find((module) => module.id === "stock");
    if (!activeModule) {
      throw new Error("Expected stock module to exist");
    }

    const html = renderToStaticMarkup(
      <ModuleSwitcher
        activeModule={activeModule}
        modules={shellModules}
        collapsed={false}
        subtext="Current workspace"
      />,
    );

    expect(html).toContain('href="/stock"');
    expect(html).toContain('href="/accounting"');
    expect(html).toContain('href="/trade/lc"');
    expect(html).toContain('href="/buying/purchase-orders"');
    expect(html).toContain('href="/selling/sales-orders"');
    expect(html).toContain('href="/platform/metadata"');
    expect(html).toContain('href="/settings/user"');
  });

  it("marks the active module with aria-current", () => {
    const activeModule = shellModules.find((module) => module.id === "stock");
    if (!activeModule) {
      throw new Error("Expected stock module to exist");
    }

    const html = renderToStaticMarkup(
      <ModuleSwitcher
        activeModule={activeModule}
        modules={shellModules}
        collapsed={false}
        subtext="Current workspace"
      />,
    );

    expect(html).toContain('href="/stock"');
    expect(html).toContain('aria-current="page"');
  });

  it("keeps the preview panel links for the active module", () => {
    const activeModule = shellModules.find((module) => module.id === "trade");
    if (!activeModule) {
      throw new Error("Expected trade module to exist");
    }

    const html = renderToStaticMarkup(
      <ModuleSwitcher
        activeModule={activeModule}
        modules={shellModules}
        collapsed={false}
        subtext="Current workspace"
      />,
    );

    expect(html).toContain("LC Dashboard");
    expect(html).toContain('href="/trade/lc"');
    expect(html).toContain("LC Register");
    expect(html).toContain('href="/trade/lc/register"');
  });
});
