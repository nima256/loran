"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Pagination } from "@/components/ui/Navigation";
import { toPersianDigits } from "@/lib/format";
import { updateAdminQuery } from "@/lib/admin-query";
import { cn } from "@/lib/utils";

/**
 * Shared controls for the admin's server-side tables.
 *
 * Search, filters and the page number all live in the query string. That makes
 * a filtered view shareable and back-button-safe, and — more importantly — it
 * means the *server* does the filtering: these tables must never pull a whole
 * table into the browser to filter it there.
 */

/**
 * Keep one optimistic URL across *all* admin filter controls. Without a shared
 * draft, rapid clicks on different filter rows each start from stale
 * useSearchParams and overwrite the other choice. In particular, a pending
 * navigation must not disable filter buttons while its database query runs.
 */
type QueryState = { pathname: string; search: string; pending: boolean };
type QueryContext = {
  state: QueryState | null;
  sync: (pathname: string, search: string) => void;
  change: (pathname: string, current: string, param: string, value: string | null) => void;
};
const AdminQueryContext = createContext<QueryContext | null>(null);

export function AdminQueryProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const latest = useRef<QueryState | null>(null);
  const [state, setState] = useState<QueryState | null>(null);

  const sync = useCallback((pathname: string, search: string) => {
    const prior = latest.current;
    // Ignore an intermediate (older) navigation while a newer click is queued.
    if (prior?.pathname === pathname && prior.pending && prior.search !== search) return;
    if (prior?.pathname === pathname && !prior.pending && prior.search === search) return;
    latest.current = { pathname, search, pending: false };
    setState(null);
  }, []);

  const change = useCallback((pathname: string, current: string, param: string, value: string | null) => {
    const previous = latest.current;
    const base = previous?.pathname === pathname && previous.pending ? previous.search : current;
    const search = updateAdminQuery(base, param, value);
    if (search === current && !previous?.pending) return;
    const draft = { pathname, search, pending: true };
    latest.current = draft;
    setState(draft);
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }, [router]);

  return <AdminQueryContext.Provider value={{ state, sync, change }}>{children}</AdminQueryContext.Provider>;
}

function useAdminQuery() {
  const context = useContext(AdminQueryContext);
  const pathname = usePathname();
  const actual = useSearchParams();
  const current = actual.toString();
  useEffect(() => context?.sync(pathname, current), [context?.sync, pathname, current]);
  const search = context?.state?.pathname === pathname ? context.state.search : current;
  const params = new URLSearchParams(search);
  const change = (param: string, value: string | null) => {
    if (context) context.change(pathname, current, param, value);
    else {
      // The provider is installed in the admin layout; this also makes a
      // standalone rendering of the control harmless rather than inert.
      throw new Error("AdminQueryProvider is missing");
    }
  };
  return { params, pathname, change, pending: context?.state?.pending ?? false };
}

/** Debounced search box. Typing does not navigate on every keystroke. */
export function AdminSearch({
  placeholder,
  className,
}: {
  placeholder: string;
  className?: string;
}) {
  const { params, change, pending } = useAdminQuery();
  const current = params.get("q") ?? "";
  const [value, setValue] = useState(current);

  // Update on history navigation/filter changes, not every render while typing.
  useEffect(() => {
    setValue(current);
  }, [current]);

  useEffect(() => {
    if (value === current) return;
    const id = setTimeout(() => change("q", value.trim() || null), 350);
    return () => clearTimeout(id);
    // `change` is intentionally not a dependency: only typed text or the
    // committed URL should restart the debounce, not an optimistic render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, current]);

  return (
    <div className={cn("relative", className)} aria-busy={pending}>
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-fg-subtle" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-md border border-border-strong bg-surface px-3 ps-10 pe-10 text-sm
                   focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="پاک کردن جست‌وجو"
          className="absolute inset-y-0 end-2 my-auto grid size-7 place-items-center rounded text-fg-subtle hover:text-fg"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A set of mutually exclusive filter chips backed by one query parameter. */
export function AdminFilterChips({
  param,
  options,
  className,
}: {
  param: string;
  options: { value: string; label: string; count?: number }[];
  className?: string;
}) {
  const { params, change, pending } = useAdminQuery();
  const active = params.get(param) ?? "";
  const select = (value: string) => change(param, value || null);

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-busy={pending}>
      {options.map((option) => {
        const isActive = active === option.value;
        return (
          <button
            key={option.value || "all"}
            type="button"
            onClick={() => select(option.value)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-fg"
                : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
            )}
          >
            {option.label}
            {option.count != null && (
              <span className="tnum opacity-75">{toPersianDigits(option.count)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Pagination that preserves the current filters. */
export function AdminPagination({
  page,
  totalPages,
  className,
}: {
  page: number;
  totalPages: number;
  className?: string;
}) {
  const { pathname, params } = useAdminQuery();

  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const next = new URLSearchParams(params.toString());
    if (target > 1) next.set("page", String(target));
    else next.delete("page");
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return <Pagination page={page} totalPages={totalPages} buildHref={hrefFor} className={className} />;
}

/** "Showing X of Y", so the operator knows the table is not the whole table. */
export function AdminResultCount({
  page,
  pageSize,
  total,
  noun = "مورد",
}: {
  page: number;
  pageSize: number;
  total: number;
  noun?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <p className="tnum text-xs text-fg-muted" aria-live="polite">
      نمایش {toPersianDigits(from)}–{toPersianDigits(to)} از {toPersianDigits(total)} {noun}
    </p>
  );
}
