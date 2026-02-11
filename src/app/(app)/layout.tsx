import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { CommandPalette, CommandPaletteProvider } from "@/components/command-palette";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <CommandPaletteProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <div className="min-h-screen bg-background">
        <Topbar user={user} />
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-[320px_1fr] px-4">
          <Sidebar />
          <main id="main-content" className="p-4 md:pr-6" tabIndex={-1}>
            <div className="rounded-2xl border border-border bg-card/50 p-6 shadow-elevated backdrop-blur-xl md:p-8">
              {children}
            </div>
          </main>
        </div>
        <CommandPalette />
      </div>
    </CommandPaletteProvider>
  );
}
