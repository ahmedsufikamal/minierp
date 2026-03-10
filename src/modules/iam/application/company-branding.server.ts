import "server-only";

import { prisma } from "@/lib/prisma";
import { normalizeBrandingLogoInput, type ActiveCompanyBranding } from "./company-branding";

export async function getActiveCompanyBranding(companyId?: string | null): Promise<ActiveCompanyBranding | null> {
  if (!companyId) {
    return null;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      accentColor: true,
      fontFamily: true,
    },
  });

  if (!company) {
    return null;
  }

  return {
    companyId: company.id,
    companyName: company.name,
    logoUrl: normalizeBrandingLogoInput(company.logoUrl),
    primaryColor: company.primaryColor,
    accentColor: company.accentColor,
    fontFamily: company.fontFamily,
  };
}
