export type PaginationParams = {
  page: number;
  limit: number;
  skip: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  nextPage: number | null;
  prevPage: number | null;
};

export function getPaginationParams(page?: string, limit?: string): PaginationParams {
  const defaultPageSize = Number(process.env.DEFAULT_PAGE_SIZE);
  const maxPageSize = Number(process.env.MAX_PAGE_SIZE);
  const requestedPage = Number(page);
  const requestedLimit = Number(limit);

  const pageNumber = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limitNumber = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : defaultPageSize;
  const cappedLimit = Math.min(limitNumber, maxPageSize);
  const skip = (pageNumber - 1) * cappedLimit;

  return { page: pageNumber, limit: cappedLimit, skip };
}

export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const nextPage = page * limit < total ? page + 1 : null;
  const prevPage = page > 1 ? page - 1 : null;

  return {
    items,
    page,
    limit,
    total,
    nextPage,
    prevPage,
  };
}
