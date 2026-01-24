import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Topbar />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-[288px_1fr]">
        <Sidebar />
        <main className="p-4 md:pr-6">
          <div className="rounded-3xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
