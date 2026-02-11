"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type DataGridColumn<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (row: T) => React.ReactNode;
};

interface DataGridProps<T> {
  title?: string;
  description?: string;
  columns: DataGridColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string) => void;
  rightSlot?: React.ReactNode;
}

export function DataGrid<T>({ title, description, columns, rows, rowKey, emptyTitle, emptyDescription, emptyAction, onRowClick, sortKey, sortOrder, onSort, rightSlot }: DataGridProps<T>) {
  return (
    <section className="surface-1 overflow-hidden">
      {(title || rightSlot) && (
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {rightSlot}
        </div>
      )}
      <div className="overflow-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="sticky top-0 z-10 bg-[hsl(var(--surface-2))]">
            <tr className="border-b border-border">
              {columns.map((col) => {
                const isActive = sortKey === col.key;
                return (
                  <th key={col.key} className={cn("px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground", col.className)}>
                    {col.sortable && onSort ? (
                      <button type="button" onClick={() => onSort(col.key)} className="focus-ring inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground">
                        {col.header}
                        {isActive ? (sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className={cn("border-b border-border last:border-b-0 hover:bg-[hsl(var(--surface-2))]", onRowClick && "cursor-pointer")} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-3 py-2.5 text-sm", col.className)}>{col.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <p className="text-sm font-medium">{emptyTitle}</p>
            {emptyDescription ? <p className="max-w-md text-sm text-muted-foreground">{emptyDescription}</p> : null}
            {emptyAction}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span>Rows: {rows.length}</span>
        <span>Pagination ready</span>
      </div>
    </section>
  );
}
