import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin, requireStepUp } from "@/modules/iam";
import { ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePlatformAdmin();
    await requireStepUp();
    const { id } = await params;

    const result = await prisma.iamSession.updateMany({
      where: { companyId: id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "ADMIN_REVOKE" },
    });

    await writeIamAudit({
      action: "SESSION_REVOKE_ALL",
      companyId: id,
      actorUserId: principal.userId,
      entityType: "Company",
      entityId: id,
      metadata: { revokedCount: result.count },
    });

    return ok({ revoked: true, count: result.count });
  } catch (error) {
    return err(error);
  }
}
