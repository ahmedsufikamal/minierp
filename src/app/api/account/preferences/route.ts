import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { err, ok, parseBody } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { accountPreferencesSchema } from "@/modules/iam/interface/schemas";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

export async function GET(request: Request) {
  try {
    assertSameOrigin(request);
    const principal = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: principal.userId },
      select: {
        id: true,
        uiThemePreference: true,
      },
    });

    if (!user) {
      throw new IamError("NOT_FOUND", "User not found");
    }

    return ok({ uiThemePreference: user.uiThemePreference });
  } catch (error) {
    return err(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const principal = await requireAuth();
    const body = await parseBody(request, accountPreferencesSchema);

    const updated = await prisma.user.update({
      where: { id: principal.userId },
      data: {
        uiThemePreference: body.uiThemePreference,
      },
      select: {
        id: true,
        uiThemePreference: true,
      },
    });

    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: principal.activeCompanyId,
      actorUserId: principal.userId,
      entityType: "User",
      entityId: principal.userId,
      after: updated,
    });

    return ok({ uiThemePreference: updated.uiThemePreference });
  } catch (error) {
    return err(error);
  }
}
