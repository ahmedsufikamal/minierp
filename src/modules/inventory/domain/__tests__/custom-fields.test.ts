import { describe, expect, it } from "vitest";
import { validateCustomFieldValue } from "@/modules/inventory/domain/custom-fields";

describe("custom field validation", () => {
  it("validates select options", () => {
    expect(() =>
      validateCustomFieldValue(
        {
          key: "color",
          fieldType: "SELECT",
          required: false,
          config: { options: ["red", "green"] },
        },
        "blue",
      ),
    ).toThrowError(/must be one of configured options/);

    expect(
      validateCustomFieldValue(
        {
          key: "color",
          fieldType: "SELECT",
          required: false,
          config: { options: ["red", "green"] },
        },
        "red",
      ),
    ).toBe("red");
  });

  it("enforces required", () => {
    expect(() =>
      validateCustomFieldValue(
        {
          key: "serial",
          fieldType: "TEXT",
          required: true,
          config: null,
        },
        "",
      ),
    ).toThrowError(/is required/);
  });

  it("coerces numeric fields", () => {
    expect(
      validateCustomFieldValue(
        {
          key: "weight",
          fieldType: "NUMBER",
          required: false,
          config: null,
        },
        "42",
      ),
    ).toBe(42);
  });
});
