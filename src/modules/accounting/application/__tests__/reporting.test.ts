import { AccountType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getBalanceByRootType, normalizeRootType } from "@/modules/accounting/application/reporting.service";

describe("accounting reporting helpers", () => {
  it("uses account type when root type is missing", () => {
    expect(normalizeRootType({ rootType: null, type: AccountType.EXPENSE })).toBe(AccountType.EXPENSE);
  });

  it("computes asset balances as debit minus credit", () => {
    expect(getBalanceByRootType(AccountType.ASSET, 15000, 4000)).toBe(11000);
  });

  it("computes liability balances as credit minus debit", () => {
    expect(getBalanceByRootType(AccountType.LIABILITY, 2000, 9000)).toBe(7000);
  });
});
