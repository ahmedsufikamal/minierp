"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { ImagePlus, RefreshCcw, Trash2, Upload } from "lucide-react";
import { CompanyBrandAsset } from "@/components/company-brand-asset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACCEPTED_COMPANY_LOGO_FILE_TYPES,
  MAX_COMPANY_LOGO_BYTES,
  coerceBrandingLogoDataUrlMimeType,
  isDataImageUrl,
  normalizeBrandingLogoInput,
  resolveCompanyBrandingFallback,
  validateBrandingLogoFile,
} from "@/modules/iam/application/company-branding";

interface OrgBrandingCardProps {
  companyName: string;
  initialLogoUrl?: string | null;
  initialPrimaryColor?: string | null;
  initialAccentColor?: string | null;
  initialFontFamily?: string | null;
  disabled?: boolean;
}

function toColorSwatch(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Invalid logo payload."));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function OrgBrandingCard({
  companyName,
  initialLogoUrl,
  initialPrimaryColor,
  initialAccentColor,
  initialFontFamily,
  disabled = false,
}: OrgBrandingCardProps) {
  const initialLogo = normalizeBrandingLogoInput(initialLogoUrl);
  const [logoUrl, setLogoUrl] = useState(initialLogo ?? "");
  const [manualLogoUrl, setManualLogoUrl] = useState(
    initialLogo && !isDataImageUrl(initialLogo) ? initialLogo : "",
  );
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor ?? "");
  const [accentColor, setAccentColor] = useState(initialAccentColor ?? "");
  const [fontFamily, setFontFamily] = useState(initialFontFamily ?? "");
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSourceLabel, setLogoSourceLabel] = useState(
    initialLogo ? (isDataImageUrl(initialLogo) ? "Saved uploaded logo" : "Saved hosted logo") : null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fallback = useMemo(() => resolveCompanyBrandingFallback(companyName), [companyName]);

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  const clearLogo = () => {
    setLogoUrl("");
    setManualLogoUrl("");
    setLogoSourceLabel(null);
    setLogoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleManualLogoChange = (value: string) => {
    setManualLogoUrl(value);
    setLogoUrl(normalizeBrandingLogoInput(value) ?? "");
    setLogoSourceLabel(value.trim() ? "Manual logo URL" : null);
    setLogoError(null);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const validation = validateBrandingLogoFile(file);
    if (!validation.ok) {
      setLogoError(validation.error);
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLogoUrl(coerceBrandingLogoDataUrlMimeType(dataUrl, file));
      setManualLogoUrl("");
      setLogoSourceLabel(file.name);
      setLogoError(null);
    } catch {
      setLogoError("We could not process that logo file. Try another image.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-[hsl(var(--border)/0.85)] bg-[hsl(var(--surface-1))/0.72] p-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Header preview
            </p>
            <p className="text-sm text-muted-foreground">
              This asset appears in the top-right workspace header and company-facing auth screens.
            </p>
          </div>

          <CompanyBrandAsset
            branding={{ companyName, logoUrl }}
            className="mt-4 h-24 w-full bg-[hsl(var(--surface-2))]"
            fallbackClassName="bg-[hsl(var(--surface-1))]"
            dataTestId="org-branding-preview"
          />

          <div className="mt-4 rounded-xl border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-2))/0.7] p-3 text-xs">
            <p className="font-medium text-foreground">
              {logoUrl ? "Current branding source" : "No company logo uploaded"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {logoSourceLabel ?? `Using initials fallback: ${fallback.initials}`}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={openPicker} disabled={disabled}>
              <Upload className="mr-1.5 h-4 w-4" />
              {logoUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {logoUrl ? (
              <Button type="button" size="sm" variant="outline" onClick={openPicker} disabled={disabled}>
                <RefreshCcw className="mr-1.5 h-4 w-4" />
                Change file
              </Button>
            ) : null}
            {logoUrl ? (
              <Button type="button" size="sm" variant="ghost" onClick={clearLogo} disabled={disabled}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_COMPANY_LOGO_FILE_TYPES}
            className="sr-only"
            onChange={handleFileChange}
            disabled={disabled}
            data-testid="org-branding-file-input"
          />

          {logoError ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {logoError}
            </p>
          ) : null}

          <p className="mt-3 text-xs text-muted-foreground">
            Accepted formats: PNG, JPG, JPEG, SVG, WEBP. Maximum file size:{" "}
            {Math.round(MAX_COMPANY_LOGO_BYTES / 1024)} KB.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <input type="hidden" name="logoUrl" value={logoUrl} />

        <div className="space-y-2">
          <Label htmlFor="org-branding-logo-url">Logo URL</Label>
          <Input
            id="org-branding-logo-url"
            value={manualLogoUrl}
            onChange={(event) => handleManualLogoChange(event.target.value)}
            placeholder="https://cdn.yourcompany.com/logo.svg"
          />
          <p className="text-xs text-muted-foreground">
            Optional: use a hosted logo URL instead of uploading a file.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="org-branding-primary-color">Primary color</Label>
            <div className="flex items-center gap-3">
              <Input
                id="org-branding-primary-color"
                name="primaryColor"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                placeholder="#124B7F"
              />
              <input
                type="color"
                aria-label="Primary color swatch"
                className="h-11 w-14 cursor-pointer rounded-lg border-2 border-input bg-background p-1"
                value={toColorSwatch(primaryColor, "#1d4ed8")}
                onChange={(event) => setPrimaryColor(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-branding-accent-color">Accent color</Label>
            <div className="flex items-center gap-3">
              <Input
                id="org-branding-accent-color"
                name="accentColor"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
                placeholder="#0F766E"
              />
              <input
                type="color"
                aria-label="Accent color swatch"
                className="h-11 w-14 cursor-pointer rounded-lg border-2 border-input bg-background p-1"
                value={toColorSwatch(accentColor, "#0f766e")}
                onChange={(event) => setAccentColor(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-branding-font-family">Font family</Label>
          <Input
            id="org-branding-font-family"
            name="fontFamily"
            value={fontFamily}
            onChange={(event) => setFontFamily(event.target.value)}
            placeholder="&quot;Plus Jakarta Sans&quot;, sans-serif"
          />
          <p className="text-xs text-muted-foreground">
            Optional: this feeds the existing tenant theme resolver for future typography changes.
          </p>
        </div>

        <div className="rounded-2xl border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-2))/0.62] p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
              <ImagePlus className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Brand asset notes</p>
              <p className="text-sm text-muted-foreground">
                Uploaded logos are stored through the current organization branding path now, and
                can be moved to signed object storage later without changing the header renderer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
