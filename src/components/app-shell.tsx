"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-white">
      <div className="flex">
        <aside className="hidden md:flex md:flex-col w-64 border-r min-h-screen p-4 gap-2">
          <Link href="/dashboard" className="font-semibold text-lg">
            miniERP
          </Link>

          <nav className="mt-4 flex flex-col gap-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                    active ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t">
            <p className="text-xs text-slate-500">
              Tip: Use Clerk Organizations to separate company data.
            </p>
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
            <div className="flex items-center justify-between p-4">
              <div className="md:hidden font-semibold">miniERP</div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block">
                  <OrganizationSwitcher
                    afterCreateOrganizationUrl="/dashboard"
                    afterLeaveOrganizationUrl="/dashboard"
                    appearance={{ elements: { rootBox: "w-[240px]" } }}
                  />
                </div>
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </header>

          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
