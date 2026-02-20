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
} as const;

export type AccountingPermission = (typeof accountingPermissions)[keyof typeof accountingPermissions];
