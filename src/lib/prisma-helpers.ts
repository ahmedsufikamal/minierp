import { prisma } from "./prisma";

/**
 * Helper to convert companyId to orgId for queries when Prisma client is stale.
 * This is a temporary compatibility layer until Prisma client is regenerated.
 */
export function withCompanyIdFallback<T>(
  queryFn: (where: { orgId: string }) => Promise<T>,
  companyId: string
): Promise<T> {
  return queryFn({ orgId: companyId });
}

/**
 * Wraps a Prisma query that uses companyId, automatically falling back to orgId
 * if companyId is not recognized by the Prisma client.
 */
export async function queryWithCompanyId<T>(
  queryFn: (where: { companyId: string }) => Promise<T>,
  fallbackFn: (where: { orgId: string }) => Promise<T>,
  companyId: string
): Promise<T> {
  try {
    return await queryFn({ companyId });
  } catch (error: any) {
    if (error?.message?.includes("Unknown argument `companyId`")) {
      return await fallbackFn({ orgId: companyId });
    }
    throw error;
  }
}
