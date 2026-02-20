import "./globals.css";

import { assertProductionSecurityEnv } from "@/lib/runtime-env";
import { getCurrentUser } from "@/lib/auth";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  assertProductionSecurityEnv();
  const tenantTheme = await resolveTenantThemeByRequest();
  const currentUser = await getCurrentUser();
  const style = themeToCssVars(tenantTheme);
  const initialTheme = toNextTheme(currentUser?.uiThemePreference);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased" style={style}>
        {tenantTheme?.customCss ? <style>{tenantTheme.customCss}</style> : null}
        <ThemeProvider
          attribute="class"
          defaultTheme={initialTheme}
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
