import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";

describe("buttonVariants", () => {
  it("includes focus and disabled behavior in base classes", () => {
    const classes = buttonVariants();
    expect(classes).toContain("focus-visible:ring-2");
    expect(classes).toContain("disabled:pointer-events-none");
  });

  it("supports all variants", () => {
    expect(buttonVariants({ variant: "default" })).toContain("bg-primary");
    expect(buttonVariants({ variant: "outline" })).toContain("bg-[hsl(var(--surface-1))]");
    expect(buttonVariants({ variant: "secondary" })).toContain("bg-[hsl(var(--surface-2))]");
    expect(buttonVariants({ variant: "ghost" })).toContain("bg-transparent");
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive");
    expect(buttonVariants({ variant: "link" })).toContain("underline-offset-4");
    expect(buttonVariants({ variant: "gradient" })).toContain("linear-gradient");
    expect(buttonVariants({ variant: "utility" })).toContain("text-muted-foreground");
  });

  it("supports all sizes", () => {
    expect(buttonVariants({ size: "xs" })).toContain("h-7");
    expect(buttonVariants({ size: "sm" })).toContain("h-9");
    expect(buttonVariants({ size: "default" })).toContain("h-10");
    expect(buttonVariants({ size: "lg" })).toContain("h-11");
    expect(buttonVariants({ size: "icon" })).toContain("w-10");
  });
});
