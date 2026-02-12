import { headers } from "next/headers";
import { getIdentityProvider } from "@/modules/iam/infrastructure/provider";

export async function resolveTenantThemeByRequest(companyId?: string | null) {
  const h = await headers();
  const host = h.get("host");
  return getIdentityProvider().resolveTenantTheme({
    host,
    companyId: companyId ?? null,
  });
}

export function themeToCssVars(theme: {
  primaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
  cssVars?: Record<string, string> | null;
} | null): Record<string, string> {
  if (!theme) return {};

  const out: Record<string, string> = {};
  if (theme.primaryColor) {
    out["--tenant-primary"] = theme.primaryColor;
    out["--primary"] = theme.primaryColor;
    out["--ring"] = theme.primaryColor;
  }
  if (theme.accentColor) {
    out["--tenant-accent"] = theme.accentColor;
    out["--accent"] = theme.accentColor;
  }
  if (theme.fontFamily) out["--tenant-font-family"] = theme.fontFamily;

  if (theme.cssVars) {
    for (const [k, v] of Object.entries(theme.cssVars)) {
      out[k.startsWith("--") ? k : `--${k}`] = String(v);
    }
  }

  return out;
}
