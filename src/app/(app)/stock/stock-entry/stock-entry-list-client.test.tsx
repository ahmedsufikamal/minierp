import { describe, expect, it, vi } from "vitest";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StockEntryListClient } from "./stock-entry-list-client";

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
  usePathname: () => "/stock/stock-entry",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      page: 1,
      limit: 25,
      total: 0,
      rows: [],
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { onSelect?: () => void }) => <div {...props}>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    size?: string;
    variant?: string;
  }) => {
    if (asChild) {
      return <>{children}</>;
    }
    return <button {...props}>{children}</button>;
  },
}));

describe("stock entry list client header", () => {
  it("uses the compact breadcrumb without Home and keeps the lower controls", () => {
    const html = renderToStaticMarkup(<StockEntryListClient warehouseOptions={[]} />);

    expect(html).toContain("Stock");
    expect(html).toContain("Stock Entry");
    expect(html).not.toContain("Home");
    expect(html).toContain("List View");
    expect(html).toContain("Saved Filters");
    expect(html).toContain("Filter");
    expect(html).toContain("Created On");
  });
});
