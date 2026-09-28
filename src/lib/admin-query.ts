/** Apply one admin table control without losing other active filters. */
export function updateAdminQuery(current: string, param: string, value: string | null): string {
  const next = new URLSearchParams(current);
  if (value) next.set(param, value);
  else next.delete(param);
  next.delete("page");
  return next.toString();
}
