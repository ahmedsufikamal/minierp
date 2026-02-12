import { prisma } from "@/lib/prisma";
import { requireTenantMembership, requirePermission, requireStepUp } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { policyConfigSchema } from "@/modules/iam/interface/schemas";
import { z } from "zod";

const updateOrgSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  logoUrl: z.string().max(1024).optional(),
  primaryColor: z.string().max(64).optional(),
  accentColor: z.string().max(64).optional(),
  fontFamily: z.string().max(160).optional(),
  cssVars: z.record(z.string(), z.string()).optional(),
  customCss: z.string().max(20_000).optional(),
  primaryDomain: z.string().max(255).optional(),
  allowedDomains: z.array(z.string().max(255)).optional(),
  domainVerificationStatus: z.enum(["PENDING", "VERIFIED", "FAILED"]).optional(),
  allowedAuthMethods: policyConfigSchema.shape.allowedAuthMethods.optional(),
  mfaPolicy: policyConfigSchema.shape.mfaPolicy.optional(),
  sessionPolicy: policyConfigSchema.shape.sessionPolicy.optional(),
  botProtectionPolicy: policyConfigSchema.shape.botProtectionPolicy.optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const principal = await requireTenantMembership();
    const { id } = await params;

    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant access blocked");
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        logoUrl: true,
        primaryColor: true,
        accentColor: true,
        fontFamily: true,
        cssVars: true,
        customCss: true,
        primaryDomain: true,
        allowedDomains: true,
        domainVerificationStatus: true,
        allowedAuthMethods: true,
        mfaPolicy: true,
        sessionPolicy: true,
        botProtectionPolicy: true,
      },
    });

    return ok(company);
  } catch (error) {
    return err(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.settings");
    await requireStepUp();
    const { id } = await params;

    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant update blocked");
    }

    const body = await parseBody(request, updateOrgSchema);

    const company = await prisma.company.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        logoUrl: body.logoUrl,
        primaryColor: body.primaryColor,
        accentColor: body.accentColor,
        fontFamily: body.fontFamily,
        cssVars: body.cssVars,
        customCss: body.customCss,
        primaryDomain: body.primaryDomain,
        allowedDomains: body.allowedDomains,
        domainVerificationStatus: body.domainVerificationStatus,
        allowedAuthMethods: body.allowedAuthMethods,
        mfaPolicy: body.mfaPolicy,
        sessionPolicy: body.sessionPolicy,
        botProtectionPolicy: body.botProtectionPolicy,
      },
      select: { id: true, name: true, slug: true },
    });

    return ok(company);
  } catch (error) {
    return err(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.settings");
    await requireStepUp();
    const { id } = await params;

    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant delete blocked");
    }

    await prisma.company.update({
      where: { id },
      data: { status: "DISABLED", isActive: false },
    });

    return ok({ disabled: true });
  } catch (error) {
    return err(error);
  }
}
