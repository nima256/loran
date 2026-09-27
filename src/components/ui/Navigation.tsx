"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Pagination. In RTL, "next" points to the left — the chevrons are mirrored
 * accordingly so the arrows match the reading direction.
 */
export function Pagination({
  page, totalPages, buildHref, onPageChange, className,
}: {
  page: number;
  totalPages: number;
  buildHref?: (page: number) => string;
  onPageChange?: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  // Always show first, last, current and its neighbours; ellipsis for the rest.
  const pages: (number | "gap")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }

  const itemClass = (active: boolean) =>
    cn(
      "tnum grid h-11 min-w-11 place-items-center rounded-md border px-3 text-sm font-medium transition-colors",
      active
        ? "border-primary bg-primary text-primary-fg"
        : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
    );

  const Item = ({ value }: { value: number }) => {
    const active = value === page;
    const content = toPersianDigits(value);
    const label = active ? `صفحه ${content}، صفحه فعلی` : `صفحه ${content}`;
    return buildHref ? (
      <Link href={buildHref(value)} aria-label={label} aria-current={active ? "page" : undefined} className={itemClass(active)}>
        {content}
      </Link>
    ) : (
      <button type="button" onClick={() => onPageChange?.(value)} aria-label={label} aria-current={active ? "page" : undefined} className={itemClass(active)}>
        {content}
      </button>
    );
  };

  const Arrow = ({ to, disabled, label, children }: { to: number; disabled: boolean; label: string; children: React.ReactNode }) => {
    const cls = cn(itemClass(false), disabled && "pointer-events-none opacity-40");
    return buildHref && !disabled ? (
      <Link href={buildHref(to)} aria-label={label} className={cls}>{children}</Link>
    ) : (
      <button type="button" disabled={disabled} onClick={() => onPageChange?.(to)} aria-label={label} className={cls}>
        {children}
      </button>
    );
  };

  return (
    <nav aria-label="صفحه‌بندی محصولات" className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      <Arrow to={page - 1} disabled={page <= 1} label="صفحه قبل">
        <ChevronRight className="size-4" aria-hidden />
      </Arrow>
      {pages.map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="grid h-11 w-8 place-items-center text-fg-subtle" aria-hidden>
            <MoreHorizontal className="size-4" />
          </span>
        ) : (
          <Item key={p} value={p} />
        )
      )}
      <Arrow to={page + 1} disabled={page >= totalPages} label="صفحه بعد">
        <ChevronLeft className="size-4" aria-hidden />
      </Arrow>
    </nav>
  );
}

export function Breadcrumbs({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="مسیر صفحه" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-fg-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
              {item.href && !last ? (
                <Link href={item.href} className="inline-flex min-h-6 items-center transition-colors hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]">{item.label}</Link>
              ) : (
                <span className={cn("truncate", last && "text-fg")} aria-current={last ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronLeft className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Underlined tab bar. Scrolls horizontally on small screens instead of wrapping. */
export function Tabs({
  tabs, value, onChange, className,
}: {
  tabs: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-border", className)}>
      <div role="tablist" className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={cn(
                "relative shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                active ? "border-primary text-primary dark:text-[color:var(--primary-soft-fg)]" : "border-transparent text-fg-muted hover:text-fg"
              )}
            >
              {tab.label}
              {tab.count != null && (
                <span className="tnum ms-1.5 text-xs text-fg-subtle">{toPersianDigits(tab.count)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Native disclosure — keyboard accessible for free, no JS state to manage. */
export function Accordion({
  items, className, defaultOpen,
}: {
  items: { id: string; title: string; content: React.ReactNode }[];
  className?: string;
  defaultOpen?: string;
}) {
  return (
    <div className={cn("divide-y divide-border rounded-lg border border-border bg-surface", className)}>
      {items.map((item) => (
        <details key={item.id} open={item.id === defaultOpen} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-start font-medium text-fg marker:hidden">
            <span>{item.title}</span>
            <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-fg-muted transition-transform duration-[--dur-base] group-open:rotate-180" fill="none" aria-hidden>
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="px-4 pb-4 text-sm leading-8 text-fg-muted">{item.content}</div>
        </details>
      ))}
    </div>
  );
}

/** Numbered progress for the checkout. Compact on mobile, labelled on desktop. */
export function Stepper({
  steps, current, className,
}: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn("flex items-center gap-2", className)} aria-label="مراحل ثبت سفارش">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={step} className="flex flex-1 items-center gap-2 last:flex-none">
            <span className="flex items-center gap-2 min-w-0">
              <span
                aria-hidden
                className={cn(
                  "tnum grid size-8 shrink-0 place-items-center rounded-full border text-sm font-bold",
                  state === "done" && "border-primary bg-primary text-primary-fg",
                  state === "current" && "border-primary bg-primary-soft text-primary-soft-fg",
                  state === "todo" && "border-border bg-surface text-fg-subtle"
                )}
              >
                {state === "done" ? "✓" : toPersianDigits(i + 1)}
              </span>
              <span
                className={cn(
                  "truncate text-sm",
                  state === "current" ? "font-semibold text-fg" : "text-fg-muted",
                  // On phones only the current step keeps its label.
                  state !== "current" && "hidden sm:inline"
                )}
              >
                {step}
              </span>
              <span className="sr-only">
                {state === "done" ? "(انجام شد)" : state === "current" ? "(مرحله فعلی)" : "(انجام نشده)"}
              </span>
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className={cn("h-px flex-1 rounded", i < current ? "bg-primary" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
