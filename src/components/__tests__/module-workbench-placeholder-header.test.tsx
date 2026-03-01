import { describe, expect, it, vi } from "vitest";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleWorkbenchPlaceholder } from "@/components/module-workbench-placeholder";

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
  usePathname: () => "/buying/purchase-receipts",
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
  useQuery: () => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
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
      return <div {...props}>{children}</div>;
    }
    return <button {...props}>{children}</button>;
  },
}));

describe("module workbench placeholder header", () => {
  it("renders the ERP list top bar variant and suppresses the legacy intro card", () => {
    const html = renderToStaticMarkup(
      <ModuleWorkbenchPlaceholder
        moduleName="Purchase Receipts"
        description="Receive goods."
        apiHref="/api/v1/buying/purchase-receipts"
        headerVariant="erp-list"
        breadcrumbTrail={["Stock", "Purchase Receipt"]}
        primaryActionLabel="Add Purchase Receipt"
        primaryActionHref="/buying/purchase-receipts"
        enableSavedFilters
      />,
    );

    expect(html).toContain("Stock");
    expect(html).toContain("Purchase Receipt");
    expect(html).toContain("Add Purchase Receipt");
    expect(html).toContain("List View");
    expect(html).toContain("Saved Filters");
    expect(html).not.toContain("API-first baseline");
  });
});
