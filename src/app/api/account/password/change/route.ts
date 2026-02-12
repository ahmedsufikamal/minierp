import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { changePasswordSchema } from "@/modules/iam/interface/schemas";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const principal = await requireAuth();
    const body = await parseBody(request, changePasswordSchema);

    const user = await prisma.user.findUnique({
      where: { id: principal.userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new IamError("NOT_FOUND", "User not found");
    }

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) {
      throw new IamError("UNAUTHORIZED", "Current password is invalid");
    }

    const nextHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.update({
      where: { id: principal.userId },
      data: {
        passwordHash: nextHash,
        mustResetPassword: false,
      },
    });
    await prisma.iamSession.updateMany({
      where: {
        userId: principal.userId,
        revokedAt: null,
        id: { not: principal.sessionId },
      },
      data: {
        revokedAt: new Date(),
        revokeReason: "SECURITY_EVENT",
      },
    });

    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: principal.activeCompanyId,
      actorUserId: principal.userId,
      entityType: "UserPassword",
      entityId: principal.userId,
    });

    return ok({ changed: true });
  } catch (error) {
    return err(error);
  }
}
