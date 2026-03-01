import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkbenchTopBar } from "@/components/listing/WorkbenchTopBar";

describe("workbench top bar", () => {
  it("renders compact breadcrumb and action slots", () => {
    const html = renderToStaticMarkup(
      <WorkbenchTopBar
        breadcrumbs={<div>Breadcrumb Trail</div>}
        actions={<button type="button">Toolbar Action</button>}
      />,
    );

    expect(html).toContain("Breadcrumb Trail");
    expect(html).toContain("Toolbar Action");
    expect(html).toContain("min-h-[64px]");
    expect(html).toContain("rounded-2xl");
    expect(html).not.toContain("text-3xl");
  });
});
