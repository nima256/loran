/** Apply one admin table control without losing other active filters. */
export function updateAdminQuery(current: string, param: string, value: string | null): string {
  const next = new URLSearchParams(current);
  if (value) next.set(param, value);
  else next.delete(param);
  next.delete("page");
  return next.toString();
}

/** Native admin filter link: server-rendered data on EVERY click, no pending lock. */
export function buildAdminQueryHref(pathname: string, search: string, param: string, value: string | null): string {
  const next = updateAdminQuery(search, param, value);
  return next ? `${pathname}?${next}` : pathname;
}
