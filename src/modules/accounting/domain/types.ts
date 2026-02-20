export const accountingPermissions = {
  accountRead: "accounting.account.read",
  accountWrite: "accounting.account.write",
  journalRead: "accounting.journal.read",
  journalWrite: "accounting.journal.write",
  journalSubmit: "accounting.journal.submit",
  glRead: "accounting.gl.read",
  periodRead: "accounting.period.read",
  periodWrite: "accounting.period.write",
  reportRead: "accounting.report.read",
  paymentEntryRead: "accounting.payment-entry.read",
  paymentEntryWrite: "accounting.payment-entry.write",
  paymentEntrySubmit: "accounting.payment-entry.submit",
  exchangeRateRead: "accounting.currency.read",
  exchangeRateWrite: "accounting.currency.write",
  costCenterRead: "accounting.dimensions.read",
  costCenterWrite: "accounting.dimensions.write",
  dimensionRead: "accounting.dimensions.read",
  dimensionWrite: "accounting.dimensions.write",
} as const;

export type AccountingPermission = (typeof accountingPermissions)[keyof typeof accountingPermissions];
