import "./globals.css";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "miniERP",
  description: "Mini ERP with Clerk + Next.js + Prisma",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: { colorPrimary: "#0f172a" },
      }}
    >
      <html lang="en">
        <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">{children}</body>
      </html>
    </ClerkProvider>
  );
}
