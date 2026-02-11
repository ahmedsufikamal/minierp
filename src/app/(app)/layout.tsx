import { CommandPalette, CommandPaletteProvider } from "@/components/command-palette";
import { AppShell } from "@/components/shell/AppShell";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <CommandPaletteProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <AppShell user={user}>{children}</AppShell>
      <CommandPalette />
    </CommandPaletteProvider>
  );
}
