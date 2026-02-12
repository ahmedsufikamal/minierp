import { prisma } from "@/lib/prisma";
import { requireTenantMembership } from "@/modules/iam";
import { ok, err } from "@/modules/iam/interface/http";

export async function GET(request: Request) {
  try {
    const principal = await requireTenantMembership();
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") || "tenant";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));

    const where =
      scope === "global" && principal.platformRole === "SUPER_ADMIN"
        ? {}
        : { companyId: principal.activeCompanyId };

    const [rows, total] = await Promise.all([
      prisma.iamAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.iamAuditLog.count({ where }),
    ]);

    return ok({
      page,
      limit,
      total,
      data: rows,
    });
  } catch (error) {
    return err(error);
  }
}
