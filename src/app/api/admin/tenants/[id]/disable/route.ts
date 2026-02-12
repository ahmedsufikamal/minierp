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

    await prisma.$transaction([
      prisma.company.update({
        where: { id },
        data: { status: "DISABLED", isActive: false },
      }),
      prisma.iamSession.updateMany({
        where: { companyId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "SECURITY_EVENT" },
      }),
    ]);

    await writeIamAudit({
      action: "TENANT_DISABLED",
      companyId: id,
      actorUserId: principal.userId,
      entityType: "Company",
      entityId: id,
    });

    return ok({ disabled: true });
  } catch (error) {
    return err(error);
  }
}
