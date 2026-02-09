export const DEFAULT_PAGE_SIZE = 20;

export function getPaginationParams(searchParams: { page?: string; limit?: string } | null) {
  const page = Math.max(1, parseInt(String(searchParams?.page ?? "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(searchParams?.limit ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function getSortParams(searchParams: { sort?: string; order?: string } | null) {
  const order = searchParams?.order === "asc" ? "asc" as const : "desc" as const;
  const sort = searchParams?.sort?.trim() || undefined;
  return { sort, order };
}

export function getSearchQuery(searchParams: { q?: string } | null): string | undefined {
  const q = searchParams?.q?.trim();
  return q === "" ? undefined : q;
}

export function getTotalPages(total: number, limit: number) {
  return Math.max(1, Math.ceil(total / limit));
}
