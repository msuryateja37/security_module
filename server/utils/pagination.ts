// Shared pagination helpers. Pagination is opt-in: an endpoint only paginates
// when the request carries a `page` (or `pageSize`) query parameter, so the
// existing full-list callers (dashboard aggregates, SLA monitor, the assistant)
// keep receiving the complete scoped array unchanged.

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

/**
 * Read page/pageSize from an Express query object. Returns null when the caller
 * did not ask for pagination (no `page` and no `pageSize`), signalling the
 * controller to fall back to its legacy full-array response.
 */
export function parsePagination(query: Record<string, unknown>): PaginationParams | null {
  if (query.page === undefined && query.pageSize === undefined) return null;

  let page = parseInt(String(query.page ?? '1'), 10);
  let pageSize = parseInt(String(query.pageSize ?? DEFAULT_PAGE_SIZE), 10);

  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return { page, pageSize };
}

/** Slice an already-scoped/filtered array into a single page + total metadata. */
export function paginate<T>(items: T[], params: PaginationParams): PaginatedResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(Math.max(1, params.page), totalPages);
  const start = (page - 1) * params.pageSize;
  return {
    data: items.slice(start, start + params.pageSize),
    page,
    pageSize: params.pageSize,
    total,
    totalPages
  };
}
