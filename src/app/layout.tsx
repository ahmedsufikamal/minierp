import "./globals.css";

import { assertProductionSecurityEnv } from "@/lib/runtime-env";
import { getCurrentUserSafe } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { ThemePreferenceSync } from "@/components/theme-preference-sync";
import { Toaster } from "@/components/ui/sonner";
import { resolveTenantThemeByRequest, themeToCssVars } from "@/modules/iam";

function toNextTheme(mode: string | null | undefined): "light" | "dark" | "system" {
  if (mode === "LIGHT") return "light";
  if (mode === "DARK") return "dark";
  return "system";
}

function buildThemeBootstrapScript(initialTheme: "light" | "dark" | "system"): string {
  return `try {
    var key = "minierp-ui-theme";
    var stored = window.localStorage.getItem(key);
    if (!stored && ${JSON.stringify(initialTheme)} !== "system") {
      window.localStorage.setItem(key, ${JSON.stringify(initialTheme)});
    }
  } catch (_) {}
  `;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  assertProductionSecurityEnv();
  const tenantTheme = await resolveTenantThemeByRequest();
  const currentUser = await getCurrentUserSafe();
  const style = themeToCssVars(tenantTheme);
  const initialTheme = toNextTheme(currentUser?.uiThemePreference);

  return (
    <html lang="en" suppressHydrationWarning className={initialTheme === "system" ? undefined : initialTheme}>
      <body className="min-h-screen bg-background text-foreground antialiased" style={style}>
        {tenantTheme?.customCss ? <style>{tenantTheme.customCss}</style> : null}
        <script dangerouslySetInnerHTML={{ __html: buildThemeBootstrapScript(initialTheme) }} />
        <ThemeProvider
          attribute="class"
          themes={["light", "dark", "system"]}
          storageKey="minierp-ui-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <ThemePreferenceSync enabled={Boolean(currentUser?.id)} initialTheme={initialTheme} />
            {children}
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
