import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ActionErrorMessage } from "@/components/auth/action-error-message";

describe("ActionErrorMessage", () => {
  it("renders structured auth errors with request id", () => {
    const html = renderToStaticMarkup(
      <ActionErrorMessage
        error={{
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
          requestId: "req-123",
        }}
      />,
    );

    expect(html).toContain("UNAUTHORIZED: Invalid credentials (Request ID: req-123)");
  });

  it("renders nothing when error is missing", () => {
    const html = renderToStaticMarkup(<ActionErrorMessage />);
    expect(html).toBe("");
  });
});
