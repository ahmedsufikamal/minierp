export const ACCEPTED_COMPANY_LOGO_FILE_TYPES = ".png,.jpg,.jpeg,.svg,.webp";
export const MAX_COMPANY_LOGO_BYTES = 512 * 1024;
export const MAX_COMPANY_LOGO_URL_LENGTH = 1_000_000;

const EXTENSION_TO_COMPANY_LOGO_MIME_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const ALLOWED_COMPANY_LOGO_MIME_TYPES = new Set([
  "image/png",
  "image/jpg",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);

const ALLOWED_COMPANY_LOGO_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".webp",
]);

export interface ActiveCompanyBranding {
  companyId: string;
  companyName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
}

export type BrandingLogoFileLike = {
  name: string;
  size: number;
  type?: string | null;
};

export type BrandingLogoValidationResult =
  | { ok: true }
  | { ok: false; error: string };

function getFileExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  return lastDot >= 0 ? normalized.slice(lastDot) : "";
}

export function normalizeBrandingLogoInput(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function isDataImageUrl(value: string | null | undefined): boolean {
  return typeof value === "string" && /^data:image\//i.test(value.trim());
}

export function resolveBrandingLogoMimeType(file: BrandingLogoFileLike): string | null {
  const type = file.type?.trim().toLowerCase() ?? "";
  if (ALLOWED_COMPANY_LOGO_MIME_TYPES.has(type)) {
    return type;
  }

  const extension = getFileExtension(file.name ?? "");
  return EXTENSION_TO_COMPANY_LOGO_MIME_TYPE[extension] ?? null;
}

export function coerceBrandingLogoDataUrlMimeType(value: string, file: BrandingLogoFileLike): string {
  const normalized = normalizeBrandingLogoInput(value);
  if (!normalized?.startsWith("data:")) {
    return value;
  }

  const mimeType = resolveBrandingLogoMimeType(file);
  if (!mimeType) {
    return normalized;
  }

  const commaIndex = normalized.indexOf(",");
  if (commaIndex < 0) {
    return normalized;
  }

  const meta = normalized.slice(5, commaIndex);
  const paramsIndex = meta.indexOf(";");
  const params = paramsIndex >= 0 ? meta.slice(paramsIndex) : "";
  return `data:${mimeType}${params}${normalized.slice(commaIndex)}`;
}

export function validateBrandingLogoFile(file: BrandingLogoFileLike): BrandingLogoValidationResult {
  const name = file.name?.trim() ?? "";
  const type = file.type?.trim().toLowerCase() ?? "";
  const extension = getFileExtension(name);

  if (!name) {
    return { ok: false, error: "Select a logo file to upload." };
  }

  if (file.size <= 0) {
    return { ok: false, error: "The selected logo file is empty." };
  }

  if (!ALLOWED_COMPANY_LOGO_MIME_TYPES.has(type) && !ALLOWED_COMPANY_LOGO_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      error: "Upload a PNG, JPG, JPEG, SVG, or WEBP logo.",
    };
  }

  if (file.size > MAX_COMPANY_LOGO_BYTES) {
    return {
      ok: false,
      error: `Logo files must be ${Math.round(MAX_COMPANY_LOGO_BYTES / 1024)} KB or smaller.`,
    };
  }

  return { ok: true };
}

export function resolveCompanyBrandingFallback(companyName?: string | null): {
  initials: string;
  label: string;
} {
  const label = companyName?.trim() || "Company";
  const cleanedWords = label
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);

  let initials = "CO";
  if (cleanedWords.length >= 2) {
    initials = `${cleanedWords[0][0] ?? ""}${cleanedWords[1][0] ?? ""}`;
  } else if (cleanedWords.length === 1) {
    initials = cleanedWords[0].slice(0, 2);
  }

  return {
    initials: initials.toUpperCase(),
    label,
  };
}
