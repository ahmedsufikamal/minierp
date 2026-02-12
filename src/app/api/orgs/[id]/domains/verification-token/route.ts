import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireStepUp } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

function buildVerificationToken(companyId: string, primaryDomain: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  return `minierp-verify.${companyId}.${primaryDomain}.${nonce}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.settings");
    await requireStepUp();
    const { id } = await params;

    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant domain verification blocked");
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        primaryDomain: true,
        domainVerificationStatus: true,
      },
    });
    if (!company) {
      throw new IamError("NOT_FOUND", "Organization not found");
    }
    if (!company.primaryDomain) {
      throw new IamError("VALIDATION_ERROR", "Set a primary domain before generating a verification token");
    }

    const token = buildVerificationToken(company.id, company.primaryDomain.toLowerCase());
    const generatedAt = new Date();

    await prisma.company.update({
      where: { id },
      data: {
        domainVerificationToken: token,
        domainVerificationGeneratedAt: generatedAt,
        domainVerificationStatus: "PENDING",
      },
    });

    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: id,
      actorUserId: principal.userId,
      entityType: "CompanyDomainVerification",
      entityId: id,
      before: { domainVerificationStatus: company.domainVerificationStatus },
      after: { domainVerificationStatus: "PENDING", generatedAt: generatedAt.toISOString() },
    });

    return ok({
      token,
      generatedAt,
      instructions: [
        `Create a TXT record for ${company.primaryDomain}`,
        `Name/Host: _minierp-verify.${company.primaryDomain}`,
        `Value: ${token}`,
      ],
    });
  } catch (error) {
    return err(error);
  }
}
