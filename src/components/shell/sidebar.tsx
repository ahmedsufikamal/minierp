"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  FileText,
  Receipt,
  Boxes,
  BookOpen,
} from "lucide-react";

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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-72 md:flex-col">
      <div className="m-4 rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold tracking-tight">miniERP</div>
          <span className="text-xs text-slate-500 dark:text-slate-400">v0.3</span>
        </div>

        <nav className="mt-4 grid gap-1">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                  "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5",
                  active &&
                    "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 rounded-xl border border-slate-200/60 p-3 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
          Tip: dark buttons always use <span className="font-semibold">white text</span> now.
        </div>
      </div>
    </aside>
  );
}
