import { prisma } from "@/lib/prisma";
import { requirePermission, requireStepUp } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { err, ok } from "@/modules/iam/interface/http";
import {
  assertCanManageTargetLevel,
  mapRoleToUserTypeLevel,
  normalizeUserTypeLevel,
} from "@/modules/iam/application/level-policy";

type RouteParams = { id: string; userId: string };

export async function POST(request: Request, { params }: { params: Promise<RouteParams> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.members");
    await requireStepUp();
    const { id, userId } = await params;

    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant revoke blocked");
    }
    if (principal.userId === userId) {
      throw new IamError("VALIDATION_ERROR", "You cannot revoke your own access");
    }

    const membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId, companyId: id } },
      select: { role: true, status: true, userTypeLevel: true },
    });
    if (!membership) {
      throw new IamError("NOT_FOUND", "Membership not found");
    }

    const targetLevel = normalizeUserTypeLevel(membership.userTypeLevel, mapRoleToUserTypeLevel(membership.role));
    assertCanManageTargetLevel(principal.effectiveLevel, targetLevel);

    await prisma.$transaction([
      prisma.companyMembership.update({
        where: { userId_companyId: { userId, companyId: id } },
        data: { status: "SUSPENDED" },
      }),
      prisma.iamSession.updateMany({
        where: { userId, companyId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "ADMIN_REVOKE" },
      }),
    ]);

    await writeIamAudit({
      action: "SESSION_REVOKED",
      companyId: id,
      actorUserId: principal.userId,
      entityType: "CompanyMembership",
      entityId: `${userId}:${id}`,
      metadata: {
        reason: "MEMBERSHIP_REVOKED",
        previousStatus: membership.status,
      },
      after: {
        status: "SUSPENDED",
      },
    });

    return ok({
      revoked: true,
      userId,
      companyId: id,
    });
  } catch (error) {
    return err(error);
  }
}
