import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireStepUp } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { verifyDomainSchema } from "@/modules/iam/interface/schemas";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function safeInt(value: string | undefined, fallback: number, min = 60, max = 31_536_000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
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

    const body = await parseBody(request, verifyDomainSchema);
    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        primaryDomain: true,
        domainVerificationStatus: true,
        domainVerificationToken: true,
        domainVerificationGeneratedAt: true,
      },
    });
    if (!company) {
      throw new IamError("NOT_FOUND", "Organization not found");
    }
    if (!company.primaryDomain) {
      throw new IamError("VALIDATION_ERROR", "Primary domain is required");
    }
    if (!company.domainVerificationToken || !company.domainVerificationGeneratedAt) {
      throw new IamError("VALIDATION_ERROR", "Generate a verification token first");
    }

    const ttlSeconds = safeInt(process.env.IAM_DOMAIN_VERIFY_TOKEN_TTL_SECONDS, 7 * 24 * 60 * 60, 300, 30 * 24 * 60 * 60);
    const expired = Date.now() - company.domainVerificationGeneratedAt.getTime() > ttlSeconds * 1000;
    if (expired) {
      throw new IamError("TOKEN_EXPIRED", "Domain verification token expired");
    }
    if (!safeCompare(company.domainVerificationToken, body.token)) {
      throw new IamError("TOKEN_INVALID", "Domain verification token invalid");
    }

    await prisma.company.update({
      where: { id },
      data: {
        domainVerificationStatus: "VERIFIED",
        domainVerificationToken: null,
        domainVerificationGeneratedAt: null,
      },
    });

    await writeIamAudit({
      action: "POLICY_UPDATED",
      companyId: id,
      actorUserId: principal.userId,
      entityType: "CompanyDomainVerification",
      entityId: id,
      before: { domainVerificationStatus: company.domainVerificationStatus },
      after: { domainVerificationStatus: "VERIFIED" },
    });

    return ok({ verified: true, domain: company.primaryDomain });
  } catch (error) {
    return err(error);
  }
}
