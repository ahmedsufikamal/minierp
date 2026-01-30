"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  FileText,
  Receipt,
  Boxes,
  BookOpen,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/auth-actions";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/vendors", label: "Vendors", icon: Truck },
  { href: "/products", label: "Products", icon: Package },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/bills", label: "Bills", icon: Receipt },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/accounting", label: "Accounting", icon: BookOpen },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-white">
      <div className="flex">
        <aside className="hidden md:flex md:flex-col w-64 border-r min-h-screen p-4 gap-2 fixed top-0 left-0 h-full bg-slate-50/50">
          <Link href="/dashboard" className="font-semibold text-lg px-2">
            miniERP
          </Link>

          <nav className="mt-4 flex flex-col gap-1">
            {nav.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t">
            <button 
              onClick={() => logout()} 
              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </aside>

        <div className="flex-1 md:ml-64">
          <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
            <div className="flex items-center justify-between p-4">
              <div className="md:hidden font-semibold">miniERP</div>
              {/* Could add a mobile menu toggle here */}
              <div className="flex items-center gap-3 ml-auto">
                 {/* Placeholder for user profile if needed */}
                 <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse" />
              </div>
            </div>
          </header>

          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
