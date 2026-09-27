"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Pagination } from "@/components/ui/Navigation";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Shared controls for the admin's server-side tables.
 *
 * Search, filters and the page number all live in the query string. That makes
 * a filtered view shareable and back-button-safe, and — more importantly — it
 * means the *server* does the filtering: these tables must never pull a whole
 * table into the browser to filter it there.
 */

/** Debounced search box. Typing does not navigate on every keystroke. */
export function AdminSearch({
  placeholder,
  className,
}: {
  placeholder: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(params.get("q") ?? "");

  // Keep in step when the URL changes from elsewhere (back button, reset).
  useEffect(() => {
    setValue(params.get("q") ?? "");
  }, [params]);

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (value === current) return;

    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      // A new search always starts at the first page.
      next.delete("page");
      startTransition(() => router.replace(`${pathname}?${next.toString()}`));
    }, 350);
    return () => clearTimeout(id);
  }, [value, params, pathname, router]);

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
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const active = params.get(param) ?? "";

  const select = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(param, value);
    else next.delete(param);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  };

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-busy={pending}>
      {options.map((option) => {
        const isActive = active === option.value;
        return (
          <button
            key={option.value || "all"}
            type="button"
            onClick={() => select(option.value)}
            disabled={pending}
            aria-pressed={isActive}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors disabled:opacity-60",
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
  const pathname = usePathname();
  const params = useSearchParams();

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
