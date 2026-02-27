"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, MoreHorizontal, RefreshCcw, Star } from "lucide-react";
import { cn } from "@/lib/cn";

type StockItemRow = {
  id: string;
  item_name: string;
  status: "ENABLED" | "DISABLED" | "TEMPLATE";
  item_group: string | null;
  item_code: string;
  updated_at: string;
  has_variants: boolean;
  variant_of: string | null;
  assigned_to: string | null;
  created_by: string | null;
  tags: string[];
};

type StockItemsResponse = {
  total: number;
  page: number;
  page_size: number;
  items: StockItemRow[];
};

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string; details?: unknown } };

type QueryState = {
  page: number;
  page_size: number;
  id: string;
  query: string;
  item_group: string;
  has_variants: string;
  variant_of: string;
  assigned_to: string;
  created_by: string;
  tags: string;
  sort: string;
};

const PAGE_SIZE_OPTIONS = [20, 100, 500, 2500];

function parseQuery(searchParams: URLSearchParams): QueryState {
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("page_size") ?? "20");
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    page_size: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : 20,
    id: searchParams.get("id") ?? "",
    query: searchParams.get("query") ?? "",
    item_group: searchParams.get("item_group") ?? "",
    has_variants: searchParams.get("has_variants") ?? "",
    variant_of: searchParams.get("variant_of") ?? "",
    assigned_to: searchParams.get("assigned_to") ?? "",
    created_by: searchParams.get("created_by") ?? "",
    tags: searchParams.get("tags") ?? "",
    sort: searchParams.get("sort") ?? "last_updated_desc",
  };
}

function statusLabel(status: StockItemRow["status"]) {
  if (status === "TEMPLATE") return "Template";
  if (status === "DISABLED") return "Disabled";
  return "Enabled";
}

function activeFilterCount(filters: QueryState) {
  return [
    filters.id,
    filters.query,
    filters.item_group,
    filters.has_variants,
    filters.variant_of,
    filters.assigned_to,
    filters.created_by,
    filters.tags,
  ].filter(Boolean).length;
}

export function StockItemsListClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialState = useMemo(() => parseQuery(new URLSearchParams(searchParams)), [searchParams]);
  const [filters, setFilters] = useState<QueryState>(initialState);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StockItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(false);

  useEffect(() => {
    setFilters(initialState);
  }, [initialState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value === "" || value === null || value === undefined) return;
        params.set(key, String(value));
      });
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filters, pathname, router]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value === "" || value === null || value === undefined) return;
        params.set(key, String(value));
      });

      try {
        const response = await fetch(`/api/stock/items?${params.toString()}`, {
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as Envelope<StockItemsResponse> | null;
        if (!alive) return;
        if (!response.ok || !body?.ok) {
          throw new Error(body && !body.ok ? (body.error?.message ?? "Failed to load items") : "Failed to load items");
        }
        setRows(body.data.items);
        setTotal(body.data.total);
      } catch (loadError) {
        if (!alive) return;
        setRows([]);
        setTotal(0);
        setError(loadError instanceof Error ? loadError.message : "Failed to load items");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(total / filters.page_size));
  const start = total === 0 ? 0 : (filters.page - 1) * filters.page_size + 1;
  const end = Math.min(total, filters.page * filters.page_size);

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="surface-1 h-fit p-4">
        <h2 className="text-sm font-semibold">Filters</h2>
        <div className="mt-3 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Assigned To</span>
            <input
              value={filters.assigned_to}
              onChange={(event) => setFilters((prev) => ({ ...prev, assigned_to: event.target.value, page: 1 }))}
              className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Created By</span>
            <input
              value={filters.created_by}
              onChange={(event) => setFilters((prev) => ({ ...prev, created_by: event.target.value, page: 1 }))}
              className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Tags (comma separated)</span>
            <input
              value={filters.tags}
              onChange={(event) => setFilters((prev) => ({ ...prev, tags: event.target.value, page: 1 }))}
              className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showTags} onChange={(event) => setShowTags(event.target.checked)} />
            Show Tags
          </label>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Save Filter</p>
            <input className="focus-ring h-10 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] px-3" />
            <button type="button" className="h-9 w-full rounded-md border border-border bg-[hsl(var(--surface-2))] text-sm">
              Save Filter (stub)
            </button>
          </div>
        </div>
      </aside>

      <section className="surface-1 overflow-hidden">
        <div className="border-b border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="h-9 rounded-md border border-border px-3 text-sm">
                List View
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border"
                onClick={() => setFilters((prev) => ({ ...prev }))}
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              <Link href="/stock/items/new" className="h-9 rounded-md border border-primary bg-primary px-3 text-sm text-primary-foreground">
                + Add Item
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
                {start}-{end} of {total}
              </span>
              <select
                value={filters.sort}
                onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value, page: 1 }))}
                className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm"
              >
                <option value="last_updated_desc">Last Updated On</option>
                <option value="name_asc">Name A-Z</option>
                <option value="name_desc">Name Z-A</option>
              </select>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-7">
            <input
              placeholder="ID"
              value={filters.id}
              onChange={(event) => setFilters((prev) => ({ ...prev, id: event.target.value, page: 1 }))}
              className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm"
            />
            <input
              placeholder="Item Name / Item Code"
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value, page: 1 }))}
              className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm"
            />
            <input
              placeholder="Item Group"
              value={filters.item_group}
              onChange={(event) => setFilters((prev) => ({ ...prev, item_group: event.target.value, page: 1 }))}
              className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm"
            />
            <label className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm">
              <input
                type="checkbox"
                checked={filters.has_variants === "true"}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, has_variants: event.target.checked ? "true" : "", page: 1 }))
                }
              />
              Has Variants
            </label>
            <input
              placeholder="Variant Of"
              value={filters.variant_of}
              onChange={(event) => setFilters((prev) => ({ ...prev, variant_of: event.target.value, page: 1 }))}
              className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm"
            />
            <button type="button" className="h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm">
              Filters ({activeFilterCount(filters)})
            </button>
            <button
              type="button"
              className="h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm"
              onClick={() =>
                setFilters({
                  page: 1,
                  page_size: 20,
                  id: "",
                  query: "",
                  item_group: "",
                  has_variants: "",
                  variant_of: "",
                  assigned_to: "",
                  created_by: "",
                  tags: "",
                  sort: "last_updated_desc",
                })
              }
            >
              Clear
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">
                  <input type="checkbox" aria-label="select all rows" />
                </th>
                <th className="px-3 py-2">Item Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Item Group</th>
                <th className="px-3 py-2">Item Code</th>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Loading items...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No items found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-3">
                      <input type="checkbox" aria-label={`select row ${row.id}`} />
                    </td>
                    <td className="px-3 py-3 font-medium">{row.item_name}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-xs",
                          row.status === "ENABLED" && "border-emerald-300 text-emerald-700 dark:text-emerald-300",
                          row.status === "DISABLED" && "border-amber-300 text-amber-700 dark:text-amber-300",
                          row.status === "TEMPLATE" && "border-blue-300 text-blue-700 dark:text-blue-300",
                        )}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">{row.item_group ?? "-"}</td>
                    <td className="px-3 py-3 font-mono text-xs">{row.item_code}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{row.id}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2 text-muted-foreground">
                        <button type="button" aria-label="comment row">
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label="favorite row">
                          <Star className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Page size</span>
            <select
              value={filters.page_size}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, page_size: Number(event.target.value), page: 1 }))
              }
              className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={filters.page <= 1}
              className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">
              Page {filters.page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
              disabled={filters.page >= totalPages}
              className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {error ? <div className="border-t border-border p-3 text-xs text-destructive">Failed to load items: {error}</div> : null}
      </section>
    </div>
  );
}
