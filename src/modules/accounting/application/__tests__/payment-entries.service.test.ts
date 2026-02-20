import { describe, expect, it } from "vitest";
import {
  assertAllocationWithinPaidAmount,
  resolveReceivedAmountCents,
} from "@/modules/accounting/application/payment-entries.service";

describe("payment entry invariants", () => {
  it("keeps same-currency received amount equal to paid amount", () => {
    const resolved = resolveReceivedAmountCents({
      paidAmountCents: 25000,
      sourceCurrency: "USD",
      targetCurrency: "USD",
    });

    expect(resolved.receivedAmountCents).toBe(25000);
    expect(resolved.exchangeRate).toBe(1);
  });

  it("derives received amount from exchange rate", () => {
    const resolved = resolveReceivedAmountCents({
      paidAmountCents: 10000,
      sourceCurrency: "USD",
      targetCurrency: "BDT",
      exchangeRate: 117.5,
    });

    expect(resolved.receivedAmountCents).toBe(1175000);
    expect(resolved.exchangeRate).toBe(117.5);
  });

  it("blocks over-allocation beyond paid amount", () => {
    expect(() =>
      assertAllocationWithinPaidAmount(5000, [
        {
          referenceType: "SALES_INVOICE",
          referenceId: "inv-1",
          allocatedAmountCents: 3000,
          currency: "USD",
        },
        {
          referenceType: "SALES_INVOICE",
          referenceId: "inv-2",
          allocatedAmountCents: 2500,
          currency: "USD",
        },
      ]),
    ).toThrowError(/exceeds paid amount/i);
  });
});
