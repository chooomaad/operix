/** Pagination au format paginateQuery de Laravel : { data, meta: { total, per_page, current_page, last_page } }. */
export function pageParams(url: URL, defaultPerPage = 25) {
  const perPage = Math.max(1, Math.min(Number.parseInt(url.searchParams.get("per_page") ?? "", 10) || defaultPerPage, 100));
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "", 10) || 1);
  return { perPage, page, offset: (page - 1) * perPage };
}

export function pageMeta(total: number, perPage: number, page: number) {
  return { total, per_page: perPage, current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)) };
}
