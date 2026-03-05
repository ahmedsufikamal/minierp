import { describe, expect, it, vi } from "vitest";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListToolbar } from "@/components/listing/ListToolbar";

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

describe("list toolbar", () => {
  it("renders the toolbar controls and a configurable stock entry action", () => {
    const html = renderToStaticMarkup(
      <ListToolbar
        savedFilters={[
          {
            id: "preset-1",
            name: "My saved filter",
          },
        ]}
        onRefresh={() => undefined}
        onSaveCurrentFilter={() => undefined}
        onApplySavedFilter={() => undefined}
        primaryActionLabel="Add Stock Entry"
        primaryActionHref="/stock/stock-entry/new?type=TRANSFER"
      />,
    );

    expect(html).toContain("List View");
    expect(html).toContain("Saved Filters");
    expect(html).toContain("Save Current Filter");
    expect(html).toContain("My saved filter");
    expect(html).toContain("Import");
    expect(html).toContain("User Permissions");
    expect(html).toContain("Role Permissions Manager");
    expect(html).toContain("Customize Quick Filters");
    expect(html).toContain("List Settings");
    expect(html).toContain("Add Stock Entry");
    expect(html).toContain('href="/stock/stock-entry/new?type=TRANSFER"');
    expect(html).toContain("text-[14px]");
  });

  it("renders dynamic primary labels and can hide optional controls", () => {
    const purchaseReceiptHtml = renderToStaticMarkup(
      <ListToolbar
        savedFilters={[]}
        onRefresh={() => undefined}
        primaryActionLabel="Add Purchase Receipt"
        primaryActionHref="/buying/purchase-receipts"
      />,
    );

    expect(purchaseReceiptHtml).toContain("Add Purchase Receipt");
    expect(purchaseReceiptHtml).toContain('href="/buying/purchase-receipts"');

    const deliveryNoteHtml = renderToStaticMarkup(
      <ListToolbar
        savedFilters={[]}
        primaryActionLabel="Add Delivery Note"
        primaryActionHref="/selling/delivery-notes"
        showViewSwitcher={false}
        showSavedFilters={false}
        showRefresh={false}
        showMoreMenu={false}
      />,
    );

    expect(deliveryNoteHtml).toContain("Add Delivery Note");
    expect(deliveryNoteHtml).not.toContain("List View");
    expect(deliveryNoteHtml).not.toContain("Saved Filters");
    expect(deliveryNoteHtml).not.toContain("Import");
  });
});
