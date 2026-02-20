export const bulkPermissions = {
  jobRead: "bulk.job.read",
  jobWrite: "bulk.job.write",
  jobRun: "bulk.job.run",
} as const;

export type BulkPermission = (typeof bulkPermissions)[keyof typeof bulkPermissions];
