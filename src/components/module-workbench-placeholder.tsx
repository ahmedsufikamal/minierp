"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Monitor, RefreshCcw } from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { ListToolbar } from "@/components/listing/ListToolbar";
import { WorkbenchTopBar } from "@/components/listing/WorkbenchTopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ModuleWorkbenchPlaceholderProps = {
  moduleName: string;
  description: string;
  apiHref?: string;
  headerVariant?: "legacy" | "erp-list";
  breadcrumbTrail?: string[];
  primaryActionLabel?: string;
  primaryActionHref?: string;
  enableSavedFilters?: boolean;
};

type RecordValue = string | number | boolean | null | undefined | Record<string, unknown> | unknown[];
type RowRecord = Record<string, RecordValue>;
type PlaceholderSavedFilterPreset = {
  id: string;
  name: string;
  search: string;
  createdAt: string;
};

function formatCell(value: RecordValue): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function normalizeRows(data: unknown): { rows: RowRecord[]; total: number; page: number; pageSize: number } {
  if (Array.isArray(data)) {
    return {
      rows: data as RowRecord[],
      total: data.length,
      page: 1,
      pageSize: data.length || 25,
    };
  }

  if (!data || typeof data !== "object") {
    return { rows: [], total: 0, page: 1, pageSize: 25 };
  }

  const record = data as Record<string, unknown>;
  const rowsCandidate = Array.isArray(record.rows)
    ? (record.rows as RowRecord[])
    : Array.isArray(record.items)
      ? (record.items as RowRecord[])
      : [];

  const total =
    typeof record.total === "number"
      ? record.total
      : typeof record.count === "number"
        ? record.count
        : rowsCandidate.length;

  const page = typeof record.page === "number" ? record.page : 1;
  const pageSize =
    typeof record.pageSize === "number"
      ? record.pageSize
      : typeof record.limit === "number"
        ? record.limit
        : rowsCandidate.length || 25;

  return { rows: rowsCandidate, total, page, pageSize };
}

function placeholderSavedFiltersStorageKey(pathname: string): string {
  if (pathname === "/buying/purchase-receipts") {
    return "minierp:list:purchase-receipts:saved-filters";
  }

  if (pathname === "/selling/delivery-notes") {
    return "minierp:list:delivery-notes:saved-filters";
  }

  const slug = pathname
    .split("/")
    .filter(Boolean)
    .join("-")
    .replace(/[^a-zA-Z0-9-]/g, "");

  return `minierp:list:${slug || "module"}:saved-filters`;
}

function loadPlaceholderSavedFilters(storageKey: string): PlaceholderSavedFilterPreset[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const candidate = entry as Partial<PlaceholderSavedFilterPreset>;
        if (
          typeof candidate.id !== "string" ||
          typeof candidate.name !== "string" ||
          typeof candidate.search !== "string" ||
          typeof candidate.createdAt !== "string"
        ) {
          return null;
        }

        return {
          id: candidate.id,
          name: candidate.name,
          search: candidate.search,
          createdAt: candidate.createdAt,
        };
      })
      .filter((entry): entry is PlaceholderSavedFilterPreset => Boolean(entry));
  } catch {
    return [];
  }
}

function savePlaceholderSavedFilter(
  storageKey: string,
  name: string,
  search: string,
): PlaceholderSavedFilterPreset[] {
  const trimmedName = name.trim();
  if (!trimmedName || typeof window === "undefined") {
    return loadPlaceholderSavedFilters(storageKey);
  }

  const nextPreset: PlaceholderSavedFilterPreset = {
    id: globalThis.crypto?.randomUUID?.() ?? `placeholder-preset-${Date.now()}`,
    name: trimmedName,
    search,
    createdAt: new Date().toISOString(),
  };

  const next = [nextPreset, ...loadPlaceholderSavedFilters(storageKey)];
  window.localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}

export function ModuleWorkbenchPlaceholder({
  moduleName,
  description,
  apiHref,
  headerVariant = "legacy",
  breadcrumbTrail,
  primaryActionLabel,
  primaryActionHref,
  enableSavedFilters = false,
}: ModuleWorkbenchPlaceholderProps) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createPayload, setCreatePayload] = useState('{\n  \n}');
  const [actionName, setActionName] = useState("SUBMIT");
  const [actionPayload, setActionPayload] = useState("{}");
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savedFilters, setSavedFilters] = useState<PlaceholderSavedFilterPreset[]>([]);

  const apiPath = apiHref ?? "";
  const pathParts = apiPath.split("/").filter(Boolean);
  const moduleKey = pathParts[2] ?? "module";
  const resourceKey = pathParts.slice(3).join("/") || moduleName.toLowerCase();
  const savedFiltersKey = useMemo(
    () => (enableSavedFilters ? placeholderSavedFiltersStorageKey(pathname ?? "") : null),
    [enableSavedFilters, pathname],
  );

  useEffect(() => {
    let cancelled = false;

    if (!savedFiltersKey) {
      queueMicrotask(() => {
        if (!cancelled) {
          setSavedFilters([]);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) {
        setSavedFilters(loadPlaceholderSavedFilters(savedFiltersKey));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [savedFiltersKey]);

  const listQuery = useQuery({
    queryKey: queryKeys.list(moduleKey, resourceKey, { page, pageSize, q: search }),
    enabled: Boolean(apiHref),
    queryFn: async () => {
      return apiGet<unknown>(apiPath, {
        query: {
          page,
          pageSize,
          q: search || undefined,
        },
      });
    },
  });

  const normalized = useMemo(() => normalizeRows(listQuery.data), [listQuery.data]);
  const rows = normalized.rows;
  const total = normalized.total;

  const selectedRowId = useMemo(() => {
    if (rows.length === 0) return null;
    if (selectedId && rows.some((row) => typeof row.id === "string" && row.id === selectedId)) {
      return selectedId;
    }
    const firstId = rows.find((row) => typeof row.id === "string")?.id;
    return typeof firstId === "string" ? firstId : null;
  }, [rows, selectedId]);

  const selectedRow = rows.find((row) => typeof row.id === "string" && row.id === selectedRowId) ?? rows[0] ?? null;

  const columns = useMemo(() => {
    if (!rows[0]) return [];
    const preferred = ["number", "name", "code", "status", "type", "currency", "updatedAt", "createdAt"];
    const keys = Object.keys(rows[0]).filter((key) => key !== "id");
    const ordered = [...preferred.filter((key) => keys.includes(key)), ...keys.filter((key) => !preferred.includes(key))];
    return ordered.slice(0, 6);
  }, [rows]);

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiPost<unknown, Record<string, unknown>>(apiPath, payload),
    onSuccess: async () => {
      setCreateError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.module(moduleKey) });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiClientError) {
        setCreateError(`${error.code}: ${error.message}`);
      } else {
        setCreateError(error instanceof Error ? error.message : "Failed to create record");
      }
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!selectedRowId) {
        throw new Error("Select a row before running an action");
      }
      return apiPatch<unknown, Record<string, unknown>>(`${apiPath}/${selectedRowId}/actions`, payload);
    },
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.module(moduleKey) });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiClientError) {
        setActionError(`${error.code}: ${error.message}`);
      } else {
        setActionError(error instanceof Error ? error.message : "Failed to run action");
      }
    },
  });

  const canGoPrev = page > 1;
  const canGoNext = page * pageSize < total;

  const effectiveBreadcrumbTrail =
    breadcrumbTrail && breadcrumbTrail.length > 0 ? breadcrumbTrail : [moduleName];

  const runCreate = () => {
    setCreateError(null);
    try {
      const parsed = JSON.parse(createPayload) as Record<string, unknown>;
      createMutation.mutate(parsed);
    } catch {
      setCreateError("Invalid JSON payload");
    }
  };

  const runAction = () => {
    setActionError(null);
    try {
      const parsed = JSON.parse(actionPayload) as Record<string, unknown>;
      actionMutation.mutate({
        action: actionName.trim().toUpperCase(),
        ...parsed,
      });
    } catch {
      setActionError("Invalid action JSON payload");
    }
  };

  return (
    <div className="space-y-5">
      {headerVariant === "erp-list" ? (
        <WorkbenchTopBar
          breadcrumbs={
            <nav
              aria-label="Breadcrumb"
              className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-muted-foreground sm:text-[15px]"
            >
              <Monitor className="h-4 w-4 shrink-0" aria-hidden />
              {effectiveBreadcrumbTrail.map((segment, index) => (
                <span key={`${segment}-${index}`} className="contents">
                  {index > 0 ? <span className="shrink-0 text-muted-foreground/70">/</span> : null}
                  <span
                    className={index === effectiveBreadcrumbTrail.length - 1 ? "truncate font-semibold text-foreground" : "truncate"}
                    aria-current={index === effectiveBreadcrumbTrail.length - 1 ? "page" : undefined}
                  >
                    {segment}
                  </span>
                </span>
              ))}
            </nav>
          }
          actions={
            <ListToolbar
              savedFilters={savedFilters.map((preset) => ({ id: preset.id, name: preset.name }))}
              onRefresh={() => {
                void listQuery.refetch();
              }}
              onSaveCurrentFilter={
                savedFiltersKey
                  ? () => {
                      const name = window.prompt("Saved filter name");
                      if (!name) return;
                      setSavedFilters(savePlaceholderSavedFilter(savedFiltersKey, name, search));
                    }
                  : undefined
              }
              onApplySavedFilter={(presetId) => {
                const preset = savedFilters.find((entry) => entry.id === presetId);
                if (!preset) return;
                setSearch(preset.search);
                setPage(1);
              }}
              primaryActionLabel={primaryActionLabel}
              primaryActionHref={primaryActionHref}
              showSavedFilters={enableSavedFilters}
            />
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{moduleName}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">API-first baseline</Badge>
            {apiHref ? <Badge variant="outline">Endpoint: {apiHref}</Badge> : null}
          </CardContent>
        </Card>
      )}

      {!apiHref ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            No canonical API route is configured for this page yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search"
                className="max-w-sm"
              />
              {headerVariant === "legacy" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => listQuery.refetch()}
                  disabled={listQuery.isFetching}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              ) : null}
              <div className="ml-auto text-sm text-muted-foreground">Rows: {total}</div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">List</CardTitle>
                <CardDescription>Canonical list contract with pagination and selection.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b [&>th]:px-3 [&>th]:py-2">
                        <th>Id</th>
                        {columns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const rowId = typeof row.id === "string" ? row.id : "";
                        const active = rowId && rowId === selectedRowId;
                        return (
                          <tr
                            key={rowId || JSON.stringify(row)}
                            className={`cursor-pointer border-b last:border-0 ${active ? "bg-muted/40" : ""}`}
                            onClick={() => setSelectedId(rowId || null)}
                          >
                            <td className="px-3 py-2 font-mono text-xs">{rowId || "—"}</td>
                            {columns.map((column) => (
                              <td key={`${rowId}-${column}`} className="px-3 py-2">
                                {formatCell(row[column])}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                            {listQuery.isLoading ? "Loading rows..." : "No rows found."}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => prev - 1)} disabled={!canGoPrev}>
                    Previous
                  </Button>
                  <div className="text-xs text-muted-foreground">Page {page}</div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => prev + 1)} disabled={!canGoNext}>
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detail</CardTitle>
                  <CardDescription>Selected row snapshot with scope metadata.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedRow ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {typeof selectedRow.tenantId === "string" ? (
                          <Badge variant="outline">Tenant: {selectedRow.tenantId}</Badge>
                        ) : null}
                        {typeof selectedRow.companyId === "string" ? (
                          <Badge variant="outline">Company: {selectedRow.companyId}</Badge>
                        ) : null}
                      </div>
                      <pre className="max-h-[280px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                        {JSON.stringify(selectedRow, null, 2)}
                      </pre>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a row from the list.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Create</CardTitle>
                  <CardDescription>Submit JSON payload to the canonical create endpoint.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <textarea
                    value={createPayload}
                    onChange={(event) => setCreatePayload(event.target.value)}
                    className="h-40 w-full rounded-md border bg-background p-3 font-mono text-xs"
                  />
                  {createError ? <p className="text-xs text-red-600">{createError}</p> : null}
                  <Button type="button" size="sm" onClick={runCreate} disabled={createMutation.isPending}>
                    Create record
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Workflow Action</CardTitle>
                  <CardDescription>Run action endpoint for the selected record.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input value={actionName} onChange={(event) => setActionName(event.target.value)} placeholder="Action (e.g. SUBMIT)" />
                  <textarea
                    value={actionPayload}
                    onChange={(event) => setActionPayload(event.target.value)}
                    className="h-24 w-full rounded-md border bg-background p-3 font-mono text-xs"
                  />
                  {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={runAction}
                    disabled={actionMutation.isPending || !selectedRowId}
                  >
                    Run action
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
