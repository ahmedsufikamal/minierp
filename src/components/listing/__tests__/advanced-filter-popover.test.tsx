import { describe, expect, it, vi } from "vitest";
import type { HTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdvancedFilterPopover } from "@/components/listing/AdvancedFilterPopover";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
}));

describe("advanced filter popover", () => {
  it("renders the filter builder controls", () => {
    const html = renderToStaticMarkup(
      <AdvancedFilterPopover value={[]} onApply={() => undefined} onClear={() => undefined} />,
    );

    expect(html).toContain("Filter");
    expect(html).toContain("ID");
    expect(html).toContain("Equals");
    expect(html).toContain('placeholder="Value"');
    expect(html).toContain("Add a Filter");
    expect(html).toContain("Clear Filters");
    expect(html).toContain("Apply Filters");
  });
});
