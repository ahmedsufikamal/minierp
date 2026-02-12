import "./globals.css";

import { assertProductionSecurityEnv } from "@/lib/runtime-env";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { resolveTenantThemeByRequest, themeToCssVars } from "@/modules/iam";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  assertProductionSecurityEnv();
  const tenantTheme = await resolveTenantThemeByRequest();
  const style = themeToCssVars(tenantTheme);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased" style={style}>
        {tenantTheme?.customCss ? <style>{tenantTheme.customCss}</style> : null}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
