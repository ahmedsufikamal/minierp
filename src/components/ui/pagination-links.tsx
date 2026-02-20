"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  totalPages: number;
  total?: number;
  limit?: number;
};

export function PaginationLinks({ page, totalPages, total, limit }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(nextPage: number) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("page", String(nextPage));
    return `${pathname}?${params.toString()}`;
  }

  if (totalPages <= 1) return null;

  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  return (
    <div className="flex items-center justify-between gap-4 py-3 px-4 border-t">
      <div className="text-sm text-muted-foreground">
        {total != null && limit != null
          ? `Showing ${(page - 1) * limit + 1}-${Math.min(page * limit, total)} of ${total}`
          : `Page ${page} of ${totalPages}`}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild disabled={page <= 1}>
          <Link href={buildHref(prevPage)}>
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
          <Link href={buildHref(nextPage)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
