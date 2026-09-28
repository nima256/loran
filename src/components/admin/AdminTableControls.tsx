"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Pagination } from "@/components/ui/Navigation";
import { toPersianDigits } from "@/lib/format";
import { buildAdminQueryHref } from "@/lib/admin-query";
import { cn } from "@/lib/utils";

/**
 * Admin lists are filtered on the server using URL query parameters.
 *
 * Do NOT hold a separate optimistic/pending copy of the URL in a persistent
 * admin layout: it can get out of sync with App Router navigation, leaving
 * every chip visually selected but unable to update the actual results.
 * Real GET links and forms make each navigation independent, work on repeated
 * clicks, and retain normal back/forward/refresh behavior.
 */

/** Debounced native GET search; pressing Enter submits immediately. */
export function AdminSearch({
  placeholder,
  className,
}: {
  placeholder: string;
  className?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("q") ?? "";
  const [value, setValue] = useState(current);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setValue(current);
  }, [current]);

  useEffect(() => {
    if (value === current) return;
    const id = window.setTimeout(() => formRef.current?.requestSubmit(), 550);
    return () => window.clearTimeout(id);
  }, [value, current]);

  return (
    <form ref={formRef} action={pathname} method="get" role="search" className={cn("relative", className)}>
      {/* Preserve other filters, but start the new search from page one. */}
      {Array.from(params.entries())
        .filter(([key]) => key !== "q" && key !== "page")
        .map(([key, item], index) => <input type="hidden" name={key} value={item} key={`${key}-${index}`} />)}
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-fg-subtle" aria-hidden />
      <input
        name="q"
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
    </form>
  );
}

/** Actual GET links, rather than buttons disabled during router transitions. */
export function AdminFilterChips({
  param,
  options,
  className,
  defaultValue = "",
}: {
  param: string;
  options: { value: string; label: string; count?: number }[];
  className?: string;
  defaultValue?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const active = params.get(param) ?? defaultValue;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group">
      {options.map((option) => {
        const isActive = active === option.value;
        return (
          <a
            key={option.value || "all"}
            href={buildAdminQueryHref(pathname, search, param, option.value || null)}
            aria-current={isActive ? "true" : undefined}
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
          </a>
        );
      })}
    </div>
  );
}

/** Pagination also uses full GET navigation, preserving active filter values. */
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

  return <Pagination page={page} totalPages={totalPages} buildHref={hrefFor} nativeLinks className={className} />;
}

/** "Showing X of Y" for the server-side result set. */
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
