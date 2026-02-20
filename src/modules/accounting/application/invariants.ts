import { PlatformError } from "@/modules/platform/domain/errors";

export type JournalLineInput = {
  accountId: string;
  debitCents: number;
  creditCents: number;
  description?: string | null;
};

export function assertValidDateRange(startDate: Date, endDate: Date): void {
  if (startDate.getTime() > endDate.getTime()) {
    throw new PlatformError("VALIDATION_ERROR", "Start date cannot be after end date");
  }
}

export function summarizeJournalLines(lines: JournalLineInput[]): {
  totalDebitCents: number;
  totalCreditCents: number;
} {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new PlatformError("VALIDATION_ERROR", "Journal entry requires at least two lines");
  }

  let totalDebitCents = 0;
  let totalCreditCents = 0;

  for (const line of lines) {
    if (!line.accountId) {
      throw new PlatformError("VALIDATION_ERROR", "Journal line account is required");
    }
    if (line.debitCents < 0 || line.creditCents < 0) {
      throw new PlatformError("VALIDATION_ERROR", "Journal amounts cannot be negative");
    }
    if (line.debitCents > 0 && line.creditCents > 0) {
      throw new PlatformError("VALIDATION_ERROR", "A journal line cannot have debit and credit together");
    }
    if (line.debitCents === 0 && line.creditCents === 0) {
      throw new PlatformError("VALIDATION_ERROR", "Journal line amount cannot be zero");
    }

    totalDebitCents += line.debitCents;
    totalCreditCents += line.creditCents;
  }

  if (totalDebitCents <= 0 || totalCreditCents <= 0) {
    throw new PlatformError("VALIDATION_ERROR", "Journal entry must contain debit and credit amounts");
  }

  if (totalDebitCents !== totalCreditCents) {
    throw new PlatformError("VALIDATION_ERROR", "Journal entry is unbalanced");
  }

  return { totalDebitCents, totalCreditCents };
}

export function assertPeriodIsOpen(input: { fiscalYearClosed: boolean; periodClosed: boolean }): void {
  if (input.fiscalYearClosed) {
    throw new PlatformError("VALIDATION_ERROR", "Fiscal year is closed");
  }
  if (input.periodClosed) {
    throw new PlatformError("VALIDATION_ERROR", "Accounting period is closed");
  }
}
