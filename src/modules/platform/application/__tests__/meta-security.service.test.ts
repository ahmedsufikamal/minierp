import { describe, expect, it } from "vitest";
import {
  renderMustacheStrict,
  stripUnsafeHtml,
  validateJsonLogicExpression,
} from "@/modules/platform/application/meta-security.service";

describe("meta security service", () => {
  it("rejects unsupported jsonlogic operators", () => {
    expect(() => validateJsonLogicExpression({ map: [{ var: "x" }, { var: "y" }] })).toThrowError(/unsupported/i);
  });

  it("renders strict escaped template variables", () => {
    const rendered = renderMustacheStrict("<p>{{name}}</p>", {
      name: '<script>alert(1)</script>',
    });

    expect(rendered).toContain("&lt;script&gt;");
  });

  it("strips unsafe html fragments", () => {
    const input = '<div onclick="alert(1)"><script>alert(1)</script>Safe</div>';
    const cleaned = stripUnsafeHtml(input);
    expect(cleaned).not.toContain("<script");
    expect(cleaned).not.toContain("onclick");
    expect(cleaned).toContain("Safe");
  });
});
