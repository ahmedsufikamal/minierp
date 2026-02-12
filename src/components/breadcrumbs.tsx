"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const segmentLabels: Record<string, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  vendors: "Vendors",
  products: "Products",
  quotes: "Quotes",
  invoices: "Invoices",
  bills: "Bills",
  payments: "Payments",
  "purchase-orders": "Purchase orders",
  inventory: "Inventory",
  accounting: "Accounting",
  reports: "Reports",
  settings: "Settings",
  "audit-log": "Audit log",
};

function labelForSegment(segment: string): string {
  return segmentLabels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  if (!pathname) return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const items = segments.map((segment, i) => {
    const href = `/${segments.slice(0, i + 1).join("/")}`;
    const isLast = i === segments.length - 1;
    const label = labelForSegment(segment);
    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
      <Link
        href="/dashboard"
        className="rounded px-1 py-0.5 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
      >
        Home
      </Link>
      {items.map(({ href: segmentHref, label, isLast }) => (
        <span key={segmentHref} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          {isLast ? (
            <span className="font-medium text-slate-900 dark:text-white" aria-current="page">
              {label}
            </span>
          ) : (
            <Link
              href={segmentHref}
              className="rounded px-1 py-0.5 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
            >
              {label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
