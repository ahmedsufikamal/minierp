import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { CommandPalette, CommandPaletteProvider } from "@/components/command-palette";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <div className="min-h-screen">
        <Topbar />
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-[288px_1fr]">
          <Sidebar />
          <main id="main-content" className="p-4 md:pr-6" tabIndex={-1}>
            <div className="rounded-3xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 md:p-6">
              {children}
            </div>
          </main>
        </div>
        <CommandPalette />
      </div>
    </CommandPaletteProvider>
  );
}
