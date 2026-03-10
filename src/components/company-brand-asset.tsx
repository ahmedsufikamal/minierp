"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  normalizeBrandingLogoInput,
  resolveCompanyBrandingFallback,
  type ActiveCompanyBranding,
} from "@/modules/iam/application/company-branding";

interface CompanyBrandAssetProps {
  branding?: Pick<ActiveCompanyBranding, "companyName" | "logoUrl"> | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  dataTestId?: string;
}

export function CompanyBrandAsset({
  branding,
  className,
  imageClassName,
  fallbackClassName,
  dataTestId,
}: CompanyBrandAssetProps) {
  const logoUrl = useMemo(() => normalizeBrandingLogoInput(branding?.logoUrl), [branding?.logoUrl]);
  const fallback = useMemo(
    () => resolveCompanyBrandingFallback(branding?.companyName),
    [branding?.companyName],
  );
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const imageFailed = Boolean(logoUrl && failedLogoUrl === logoUrl);

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-2xl border border-[hsl(var(--border)/0.88)]",
        "bg-[linear-gradient(180deg,hsl(var(--surface-1))_0%,hsl(var(--surface-2))_100%)] px-3 py-2 shadow-sm",
        className,
      )}
      data-testid={dataTestId}
      aria-label={`${fallback.label} brand`}
    >
      {logoUrl && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${fallback.label} logo`}
          className={cn("h-full w-full object-contain", imageClassName)}
          onError={() => setFailedLogoUrl(logoUrl)}
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border)/0.75)]",
            "bg-[hsl(var(--surface-1))/0.72] text-center",
            fallbackClassName,
          )}
        >
          <span className="text-sm font-semibold uppercase tracking-[0.32em] text-foreground">
            {fallback.initials}
          </span>
        </div>
      )}
    </div>
  );
}
