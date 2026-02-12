import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin, requireStepUp } from "@/modules/iam";
import { parseMfaPolicy } from "@/modules/iam/application/policy";
import { ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePlatformAdmin();
    await requireStepUp();
    const { id } = await params;

    const company = await prisma.company.findUnique({
      where: { id },
      select: { mfaPolicy: true },
    });
    const current = parseMfaPolicy(company?.mfaPolicy);
    const next = {
      ...current,
      mode: "REQUIRED_FOR_ALL" as const,
    };

    await prisma.company.update({
      where: { id },
      data: {
        mfaPolicy: next,
      },
    });

    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: id,
      actorUserId: principal.userId,
      entityType: "Company",
      entityId: id,
      before: { mfaPolicy: current },
      after: { mfaPolicy: next },
    });

    return ok({ forcedMfa: true });
  } catch (error) {
    return err(error);
  }
}
