import { describe, expect, it } from "vitest";
import {
  coerceBrandingLogoDataUrlMimeType,
  MAX_COMPANY_LOGO_BYTES,
  isDataImageUrl,
  normalizeBrandingLogoInput,
  resolveCompanyBrandingFallback,
  validateBrandingLogoFile,
} from "@/modules/iam/application/company-branding";

describe("company branding helpers", () => {
  it("accepts supported logo file types and rejects unsupported ones", () => {
    expect(
      validateBrandingLogoFile({
        name: "logo.svg",
        type: "image/svg+xml",
        size: 12_000,
      }),
    ).toEqual({ ok: true });

    expect(
      validateBrandingLogoFile({
        name: "logo.txt",
        type: "text/plain",
        size: 200,
      }),
    ).toEqual({
      ok: false,
      error: "Upload a PNG, JPG, JPEG, SVG, or WEBP logo.",
    });
  });

  it("rejects oversized logo files", () => {
    expect(
      validateBrandingLogoFile({
        name: "large.png",
        type: "image/png",
        size: MAX_COMPANY_LOGO_BYTES + 1,
      }),
    ).toEqual({
      ok: false,
      error: "Logo files must be 512 KB or smaller.",
    });
  });

  it("normalizes empty and whitespace-only logo values", () => {
    expect(normalizeBrandingLogoInput("   ")).toBeNull();
    expect(normalizeBrandingLogoInput(" https://cdn.example.com/logo.svg ")).toBe(
      "https://cdn.example.com/logo.svg",
    );
  });

  it("detects data image urls", () => {
    expect(isDataImageUrl("data:image/png;base64,abc123")).toBe(true);
    expect(isDataImageUrl("https://cdn.example.com/logo.png")).toBe(false);
  });

  it("coerces uploaded data urls to the validated image mime type", () => {
    expect(
      coerceBrandingLogoDataUrlMimeType("data:application/octet-stream;base64,abc123", {
        name: "logo.svg",
        type: "",
        size: 120,
      }),
    ).toBe("data:image/svg+xml;base64,abc123");
  });

  it("derives company initials for fallback states", () => {
    expect(resolveCompanyBrandingFallback("YGEN Company")).toEqual({
      initials: "YC",
      label: "YGEN Company",
    });
    expect(resolveCompanyBrandingFallback("YGEN")).toEqual({
      initials: "YG",
      label: "YGEN",
    });
    expect(resolveCompanyBrandingFallback("")).toEqual({
      initials: "CO",
      label: "Company",
    });
  });
});
