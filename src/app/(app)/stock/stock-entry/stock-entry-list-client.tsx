"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Monitor, X } from "lucide-react";
import { AdvancedFilterPopover } from "@/components/listing/AdvancedFilterPopover";
import { ListPageHeader } from "@/components/listing/ListPageHeader";
import { ListToolbar } from "@/components/listing/ListToolbar";
import { QuickFiltersRow } from "@/components/listing/QuickFiltersRow";
import { SortMenu } from "@/components/listing/SortMenu";
import {
  applySavedStockEntryFilter,
  createDefaultStockEntryListState,
  loadSavedStockEntryFilters,
  parseStockEntryListState,
  saveCurrentStockEntryFilter,
  toStockEntryListQuery,
  toStockEntryListSearchParams,
} from "@/components/listing/list-state";
import type {
  QuickFilters,
  SavedFilterPreset,
  StockEntryListState,
  WarehouseOption,
} from "@/components/listing/list-types";
import { labelForStockEntryType } from "@/components/listing/list-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils";

type InventoryDocumentListRow = {
  id: string;
  number: string;
  documentType: "ADJUSTMENT" | "TRANSFER" | "RECEIPT" | "ISSUE" | "COUNT";
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "POSTED";
  createdAt: string;
  updatedAt: string;
  sourceWarehouse?: { id: string; code: string; name: string } | null;
  destinationWarehouse?: { id: string; code: string; name: string } | null;
  externalRef?: string | null;
  lines: Array<{ id: string }>;
};

type InventoryDocumentListResponse = {
  page: number;
  limit: number;
  total: number;
  rows: InventoryDocumentListRow[];
};

function statusVariant(status: InventoryDocumentListRow["status"]) {
  switch (status) {
    case "POSTED":
      return "success";
    case "APPROVED":
      return "info";
    case "SUBMITTED":
      return "warning";
    case "REJECTED":
      return "error";
    case "CANCELLED":
      return "secondary";
    default:
      return "outline";
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

interface StockEntryListClientProps {
  warehouseOptions: WarehouseOption[];
}

export function StockEntryListClient({ warehouseOptions }: StockEntryListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlState = useMemo(
    () => parseStockEntryListState(new URLSearchParams(searchParams?.toString() ?? "")),
    [searchParams],
  );
  const urlStateQueryString = useMemo(
    () => toStockEntryListSearchParams(urlState).toString(),
    [urlState],
  );

  const [state, setState] = useState<StockEntryListState>(urlState);
  const [savedFilters, setSavedFilters] = useState<SavedFilterPreset[]>([]);

  useEffect(() => {
    setSavedFilters(loadSavedStockEntryFilters());
  }, []);

  useEffect(() => {
    setState((current) => {
      const currentQueryString = toStockEntryListSearchParams(current).toString();
      return currentQueryString === urlStateQueryString ? current : urlState;
    });
  }, [urlState, urlStateQueryString]);

  const stateQueryString = useMemo(
    () => toStockEntryListSearchParams(state).toString(),
    [state],
  );

  useEffect(() => {
    if (stateQueryString === urlStateQueryString) return;
    const timer = window.setTimeout(() => {
      const href = stateQueryString ? `${pathname}?${stateQueryString}` : pathname;
      router.replace(href, { scroll: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [pathname, router, stateQueryString, urlStateQueryString]);

  const queryObject = useMemo(() => toStockEntryListQuery(state), [state]);

  const listQuery = useQuery({
    queryKey: queryKeys.list("inventory", "documents", queryObject),
    queryFn: () =>
      apiGet<InventoryDocumentListResponse>("/api/v1/inventory/documents", {
        query: queryObject,
      }),
  });

  const rows = listQuery.data?.rows ?? [];

  const updateQuickFilters = (nextQuickFilters: QuickFilters) => {
    setState((current) => ({
      ...current,
      page: 1,
      quickFilters: nextQuickFilters,
    }));
  };

  const clearFilters = () => {
    setState((current) => ({
      ...current,
      page: 1,
      quickFilters: {},
      advancedFilters: [],
    }));
  };

  const handleSaveCurrentFilter = () => {
    const name = window.prompt("Saved filter name");
    if (!name) return;
    const next = saveCurrentStockEntryFilter(name, {
      quickFilters: state.quickFilters,
      advancedFilters: state.advancedFilters,
      sort: state.sort,
    });
    setSavedFilters(next);
  };

  const total = listQuery.data?.total ?? 0;

  return (
    <div className="space-y-5">
      <ListPageHeader
        breadcrumbs={
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-muted-foreground sm:text-[15px]"
          >
            <Monitor className="h-4 w-4 shrink-0" aria-hidden />
            <Link href="/stock" className="truncate transition-colors hover:text-foreground">
              Stock
            </Link>
            <span className="shrink-0 text-muted-foreground/70">/</span>
            <span className="truncate font-semibold text-foreground" aria-current="page">
              Stock Entry
            </span>
          </nav>
        }
        toolbar={
          <ListToolbar
            savedFilters={savedFilters.map((preset) => ({ id: preset.id, name: preset.name }))}
            onRefresh={() => {
              void listQuery.refetch();
            }}
            onSaveCurrentFilter={handleSaveCurrentFilter}
            onApplySavedFilter={(presetId) => {
              const preset = savedFilters.find((entry) => entry.id === presetId);
              if (!preset) return;
              setState((current) => applySavedStockEntryFilter(current, preset));
            }}
            primaryActionLabel="Add Stock Entry"
            primaryActionHref="/stock/stock-entry/new?type=TRANSFER"
          />
        }
        quickFilters={
          <QuickFiltersRow
            quickFilters={state.quickFilters}
            warehouseOptions={warehouseOptions}
            onChange={updateQuickFilters}
          />
        }
        actions={
          <>
            <AdvancedFilterPopover
              value={state.advancedFilters}
              onApply={(filters) =>
                setState((current) => ({
                  ...current,
                  page: 1,
                  advancedFilters: filters,
                }))
              }
              onClear={clearFilters}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={clearFilters}
              aria-label="Clear all filters"
            >
              <X className="h-4 w-4" />
            </Button>
            <SortMenu
              value={state.sort}
              onChange={(sort) =>
                setState((current) => ({
                  ...current,
                  page: 1,
                  sort,
                }))
              }
            />
          </>
        }
      />

      <section className="overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Stock Entry List</h2>
              <p className="text-sm text-muted-foreground">
                Track draft, approved, and posted stock movements with ERPNext-style list controls.
              </p>
            </div>
            <div className="rounded-full border border-border bg-[hsl(var(--surface-1))] px-3 py-1 text-xs text-muted-foreground">
              Total rows: {total}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Stock Entry Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Default Source Warehouse</th>
                <th className="px-4 py-3 font-medium">Default Target Warehouse</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Created On</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={`loading-row-${index}`} className="border-t border-border">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-4 animate-pulse rounded-full bg-[hsl(var(--surface-2))]" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-[hsl(var(--surface-2))]">
                        <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-foreground">No stock entries yet</p>
                        <p className="text-sm text-muted-foreground">
                          Create your first Stock Entry to start tracking inventory movements.
                        </p>
                      </div>
                      <Button asChild size="sm" className="rounded-xl">
                        <Link href="/stock/stock-entry/new?type=TRANSFER">Create your first Stock Entry</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-t border-border transition-colors hover:bg-[hsl(var(--surface-2))]",
                      "cursor-pointer",
                    )}
                    onClick={() => router.push(`/stock/stock-entry/${row.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{row.number}</td>
                    <td className="px-4 py-3">{labelForStockEntryType(row.documentType)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {row.sourceWarehouse ? `${row.sourceWarehouse.code} · ${row.sourceWarehouse.name}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.destinationWarehouse
                        ? `${row.destinationWarehouse.code} · ${row.destinationWarehouse.name}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{row.lines.length}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(row.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {listQuery.isError ? (
          <div className="border-t border-border px-5 py-3 text-sm text-destructive">
            Failed to load stock entries: {listQuery.error instanceof Error ? listQuery.error.message : "Unknown error"}
          </div>
        ) : null}
      </section>
    </div>
  );
}
