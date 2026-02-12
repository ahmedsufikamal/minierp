import { prisma } from "@/lib/prisma";
import { requireTenantMembership, requirePermission } from "@/modules/iam";
import { ok, err } from "@/modules/iam/interface/http";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const principal = await requireTenantMembership();
    const { id } = await params;

    if (principal.activeCompanyId !== id) {
      await requirePermission("admin.settings");
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
    const principal = await requirePermission("admin.settings");
    const { id } = await params;

    if (principal.activeCompanyId !== id) {
      return err(new Error("Cross-tenant update blocked"));
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const company = await prisma.company.update({
      where: { id },
      data: {
        name: typeof body.name === "string" ? body.name : undefined,
        slug: typeof body.slug === "string" ? body.slug : undefined,
        logoUrl: typeof body.logoUrl === "string" ? body.logoUrl : undefined,
        primaryColor: typeof body.primaryColor === "string" ? body.primaryColor : undefined,
        accentColor: typeof body.accentColor === "string" ? body.accentColor : undefined,
        fontFamily: typeof body.fontFamily === "string" ? body.fontFamily : undefined,
        cssVars: body.cssVars as object | undefined,
        customCss: typeof body.customCss === "string" ? body.customCss : undefined,
        primaryDomain: typeof body.primaryDomain === "string" ? body.primaryDomain : undefined,
        allowedDomains: body.allowedDomains as object | undefined,
        domainVerificationStatus:
          typeof body.domainVerificationStatus === "string" ? (body.domainVerificationStatus as never) : undefined,
        allowedAuthMethods: body.allowedAuthMethods as object | undefined,
        mfaPolicy: body.mfaPolicy as object | undefined,
        sessionPolicy: body.sessionPolicy as object | undefined,
        botProtectionPolicy: body.botProtectionPolicy as object | undefined,
      },
      select: { id: true, name: true, slug: true },
    });

    return ok(company);
  } catch (error) {
    return err(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const principal = await requirePermission("admin.settings");
    const { id } = await params;

    if (principal.activeCompanyId !== id) {
      return err(new Error("Cross-tenant delete blocked"));
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
