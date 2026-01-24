export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      {children}
    </main>
  );
}
