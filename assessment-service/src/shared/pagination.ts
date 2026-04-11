const MAX_LIMIT = 30;

export type PaginationQuery = {
  page: number;
  limit: number;
  skip: number;
};

export function parsePaginationQuery(query: Record<string, unknown>): PaginationQuery {
  const pageRaw = Number(query.page ?? 1);
  const limitRaw = Number(query.limit ?? 25);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limitUncapped = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 25;
  const limit = Math.min(MAX_LIMIT, limitUncapped);
  return { page, limit, skip: (page - 1) * limit };
}

export type PaginatedPayload<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  nextPage: number | null;
  prevPage: number | null;
};

export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedPayload<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const nextPage = totalPages > 0 && page < totalPages ? page + 1 : null;
  const prevPage = page > 1 ? page - 1 : null;
  return { items, page, limit, total, nextPage, prevPage };
}
