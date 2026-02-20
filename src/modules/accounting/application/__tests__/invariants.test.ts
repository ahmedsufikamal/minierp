import { describe, expect, it } from "vitest";
import { assertPeriodIsOpen, assertValidDateRange, summarizeJournalLines } from "@/modules/accounting/application/invariants";

describe("accounting invariants", () => {
  it("accepts balanced journal lines", () => {
    const totals = summarizeJournalLines([
      { accountId: "a1", debitCents: 5000, creditCents: 0 },
      { accountId: "a2", debitCents: 0, creditCents: 5000 },
    ]);

    expect(totals.totalDebitCents).toBe(5000);
    expect(totals.totalCreditCents).toBe(5000);
  });

  it("rejects unbalanced journal lines", () => {
    expect(() =>
      summarizeJournalLines([
        { accountId: "a1", debitCents: 6000, creditCents: 0 },
        { accountId: "a2", debitCents: 0, creditCents: 5000 },
      ]),
    ).toThrowError(/unbalanced/i);
  });

  it("rejects lines with both debit and credit values", () => {
    expect(() =>
      summarizeJournalLines([
        { accountId: "a1", debitCents: 1000, creditCents: 1000 },
        { accountId: "a2", debitCents: 0, creditCents: 2000 },
      ]),
    ).toThrowError(/debit and credit together/i);
  });

  it("rejects invalid date ranges", () => {
    expect(() => assertValidDateRange(new Date("2026-12-31"), new Date("2026-01-01"))).toThrowError(
      /start date/i,
    );
  });

  it("blocks posting in closed periods", () => {
    expect(() => assertPeriodIsOpen({ fiscalYearClosed: false, periodClosed: true })).toThrowError(/period/i);
  });
});
