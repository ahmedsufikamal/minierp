import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin, requireStepUp } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";
import { z } from "zod";

const forcePasswordResetBodySchema = z.object({
  reason: z.string().min(4).max(500).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePlatformAdmin();
    await requireStepUp();
    const body = await parseBody(request, forcePasswordResetBodySchema);
    const { id } = await params;

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, activeCompanyId: true },
    });
    if (!targetUser) {
      throw new IamError("NOT_FOUND", "User not found");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          mustResetPassword: true,
        },
      }),
      prisma.iamSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: "SECURITY_EVENT",
        },
      }),
    ]);

    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: targetUser.activeCompanyId ?? null,
      actorUserId: principal.userId,
      entityType: "User",
      entityId: id,
      metadata: {
        forcedPasswordReset: true,
        reason: body.reason ?? null,
      },
    });

    return ok({ forced: true });
  } catch (error) {
    return err(error);
  }
}
