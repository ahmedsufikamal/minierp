import { describe, expect, it } from "vitest";
import {
  canApproveWithDualControl,
  canTransitionLcStatus,
  resolveEffectiveLcStatus,
} from "@/modules/trade/application/lc.service";

describe("trade lc workflow helpers", () => {
  it("allows valid transitions and blocks invalid ones", () => {
    expect(canTransitionLcStatus("DRAFT", "SUBMIT")).toBe(true);
    expect(canTransitionLcStatus("REQUESTED", "APPROVE")).toBe(true);
    expect(canTransitionLcStatus("APPROVED", "ISSUE")).toBe(true);
    expect(canTransitionLcStatus("DRAFT", "ISSUE")).toBe(false);
    expect(canTransitionLcStatus("ISSUED", "CANCEL")).toBe(false);
  });

  it("enforces dual-control approval when enabled", () => {
    expect(
      canApproveWithDualControl({
        dualControlEnabled: true,
        createdBy: "user-1",
        actorUserId: "user-1",
      }),
    ).toBe(false);

    expect(
      canApproveWithDualControl({
        dualControlEnabled: true,
        createdBy: "user-1",
        actorUserId: "user-2",
      }),
    ).toBe(true);

    expect(
      canApproveWithDualControl({
        dualControlEnabled: false,
        createdBy: "user-1",
        actorUserId: "user-1",
      }),
    ).toBe(true);
  });

  it("computes an effective EXPIRED status for open LCs beyond expiry", () => {
    expect(
      resolveEffectiveLcStatus(
        "ACTIVE",
        new Date("2024-01-01T00:00:00.000Z"),
        new Date("2025-01-01T00:00:00.000Z"),
      ),
    ).toBe("EXPIRED");

    expect(
      resolveEffectiveLcStatus(
        "CLOSED",
        new Date("2024-01-01T00:00:00.000Z"),
        new Date("2025-01-01T00:00:00.000Z"),
      ),
    ).toBe("CLOSED");
  });
});
