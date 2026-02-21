import { randomUUID } from "node:crypto";
import { verifySession } from "@/lib/session";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { resolveTenantForCompany } from "@/modules/platform/application/tenant-context.service";

function normalizePlatformRole(input: unknown): "SUPER_ADMIN" | "SUPPORT" | "NONE" {
  if (input === "SUPER_ADMIN" || input === "SUPPORT") {
    return input;
  }
  return "NONE";
}

export async function getPlatformContextForServerAction(): Promise<PlatformRequestContext> {
  const session = await verifySession();
  if (!session?.userId) {
    throw new PlatformError("UNAUTHORIZED", "Authentication required");
  }

  const companyId = session.companyId ?? session.userId;
  const tenantId = await resolveTenantForCompany(companyId);

  return {
    requestId: randomUUID(),
    tenantId,
    companyId,
    userId: session.userId,
    role: session.role ?? "MEMBER",
    platformRole: normalizePlatformRole(session.platformRole),
    permissions: Array.isArray(session.permissions) ? session.permissions : [],
  };
}
