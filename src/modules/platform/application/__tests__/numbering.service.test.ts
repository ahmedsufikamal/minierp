import { describe, expect, it } from "vitest";
import { NumberSeriesResetPolicy } from "@prisma/client";
import { applyPattern, periodKeyFor, validatePattern } from "@/modules/platform/application/numbering.service";

describe("numbering service helpers", () => {
  it("validates sequence token presence", () => {
    expect(() => validatePattern("SINV-{YYYY}"))
      .toThrowError(/sequence token/i);
  });

  it("builds period keys using reset policy", () => {
    const date = new Date("2026-02-10T00:00:00.000Z");

    expect(periodKeyFor({ date, resetPolicy: NumberSeriesResetPolicy.NEVER })).toBe("GLOBAL");
    expect(periodKeyFor({ date, resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR })).toBe("2026");
    expect(periodKeyFor({ date, resetPolicy: NumberSeriesResetPolicy.MONTHLY })).toBe("2026-02");
    expect(periodKeyFor({ date, fiscalYear: "FY26", resetPolicy: NumberSeriesResetPolicy.FISCAL_YEAR })).toBe("FY26");
  });

  it("applies pattern tokens and sequence padding", () => {
    const formatted = applyPattern({
      pattern: "SINV-{FY}-{COMP}-{####}",
      sequence: 42,
      padding: 4,
      tenantKey: "demo-tenant",
      companyCode: "demo-company",
      fiscalYear: "FY26",
      date: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(formatted).toBe("SINV-FY26-demo-company-0042");
  });
});
