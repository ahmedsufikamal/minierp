import { describe, expect, it } from "vitest";
import { getDiscrepancyDrivenStatus } from "@/modules/trade/application/lc.service";

describe("trade lc discrepancy helpers", () => {
  it("keeps the LC discrepant when any discrepancy is pending or rejected", () => {
    expect(getDiscrepancyDrivenStatus(["PENDING"])).toBe("DISCREPANT");
    expect(getDiscrepancyDrivenStatus(["WAIVED", "REJECTED"])).toBe("DISCREPANT");
  });

  it("promotes the LC to accepted when all discrepancies are resolved", () => {
    expect(getDiscrepancyDrivenStatus(["WAIVED", "ACCEPTED"])).toBe("ACCEPTED");
  });
});
