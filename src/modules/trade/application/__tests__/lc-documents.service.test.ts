import { describe, expect, it } from "vitest";
import { canVerifyDocumentChecklist } from "@/modules/trade/application/lc.service";

describe("trade lc document helpers", () => {
  it("passes verification when all required documents are received", () => {
    expect(
      canVerifyDocumentChecklist([
        { required: true, received: true },
        { required: false, received: false },
      ]),
    ).toBe(true);
  });

  it("fails verification when a required document is missing", () => {
    expect(
      canVerifyDocumentChecklist([
        { required: true, received: false },
        { required: true, received: true },
      ]),
    ).toBe(false);
  });
});
