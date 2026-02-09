"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type Props = {
  sortKey: string;
  label: string;
  currentSort?: string;
  currentOrder?: "asc" | "desc";
  className?: string;
};

export function SortableTh({ sortKey, label, currentSort, currentOrder, className }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(nextSort: string, nextOrder: "asc" | "desc") {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("sort", nextSort);
    params.set("order", nextOrder);
    return `${pathname}?${params.toString()}`;
  }

  const isActive = currentSort === sortKey;
  const nextOrder =
    isActive && currentOrder === "asc" ? "desc" : "asc";
  const href = buildHref(sortKey, nextOrder);

  return (
    <th scope="col" className={className ?? "px-4 py-3 text-left"}>
      <Link
        href={href}
        className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
      >
        {label}
        {isActive ? (
          currentOrder === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
        )}
      </Link>
    </th>
  );
}
