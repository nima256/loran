"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Search, TrendingUp, X } from "lucide-react";
import { POPULAR_SEARCHES } from "@/lib/catalog-constants";
// `query` is aliased: the component already has a `query` state variable.
import { api, query as buildQuery } from "@/lib/api/client";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types";
import { Spinner } from "@/components/ui/Feedback";

const RECENT_KEY = "loran:recent-searches";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function pushRecentSearch(query: string) {
  const term = query.trim();
  if (!term) return;
  try {
    const next = [term, ...readRecent().filter((r) => r !== term)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Search still works without history.
  }
}

/**
 * Full search experience opened from the header.
 *
 * Suggestions are debounced and the results list is keyboard-navigable
 * (↑/↓/Enter), so search is usable without ever touching the mouse.
 */
export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    setActiveIndex(-1);
    const id = setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Debounced suggestions — 200ms is fast enough to feel instant while typing.
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const id = setTimeout(async () => {
      try {
        const data = await api.get<{ items: ProductSummary[] }>(
          `/api/v1/products/suggestions${buildQuery({ q: term, limit: 6 })}`,
          { signal: controller.signal }
        );
        setResults(data.items);
      } catch (error) {
        // An aborted request is the expected outcome of typing another key.
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  const submit = (term: string) => {
    const value = term.trim();
    if (!value) return;
    pushRecentSearch(value);
    onClose();
    router.push(`/search?q=${encodeURIComponent(value)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        onClose();
        router.push(`/product/${results[activeIndex].slug}`);
      } else {
        submit(query);
      }
    }
  };

  const showEmpty = !loading && query.trim().length > 0 && results.length === 0;
  const suggestions = useMemo(() => recent.slice(0, 6), [recent]);

  if (!open) return null;

  return (
    <div className="fixed inset-0" style={{ zIndex: "var(--z-modal)" }} role="dialog" aria-modal="true" aria-label="جست‌وجوی محصولات">
      <div className="absolute inset-0 bg-[#1b1310]/55 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden />
      <div className="animate-slide-up relative mx-auto flex h-dvh w-full max-w-3xl flex-col bg-canvas sm:mt-16 sm:h-auto sm:max-h-[80dvh] sm:rounded-xl sm:border sm:border-border sm:bg-surface sm:shadow-e3">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Search className="ms-1 size-5 shrink-0 text-fg-subtle" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
            onKeyDown={onKeyDown}
            placeholder="نام کفش، دسته‌بندی یا رنگ را بنویسید…"
            aria-label="عبارت جست‌وجو"
            aria-autocomplete="list"
            aria-controls="search-results"
            className="h-11 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
          />
          {loading && <Spinner className="size-5 text-fg-subtle" />}
          <button type="button" onClick={onClose} aria-label="بستن جست‌وجو" className="grid size-11 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg">
            <X className="size-5" />
          </button>
        </div>

        <div id="search-results" className="flex-1 overflow-y-auto overscroll-contain p-3">
          {!query.trim() && (
            <div className="space-y-6">
              {suggestions.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-fg-subtle">
                    <Clock className="size-3.5" aria-hidden /> جست‌وجوهای اخیر
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((term) => (
                      <button key={term} type="button" onClick={() => submit(term)}
                        className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-fg-muted hover:border-border-strong hover:text-fg">
                        {term}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-fg-subtle">
                  <TrendingUp className="size-3.5" aria-hidden /> جست‌وجوهای پرطرفدار
                </h3>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SEARCHES.map((term) => (
                    <button key={term} type="button" onClick={() => submit(term)}
                      className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-fg-muted hover:border-primary hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]">
                      {term}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {results.length > 0 && (
            <ul role="listbox" aria-label="پیشنهادهای جست‌وجو" className="space-y-1">
              {results.map((product, i) => (
                <li key={product.id} role="option" aria-selected={i === activeIndex}>
                  <Link
                    href={`/product/${product.slug}`}
                    onClick={() => { pushRecentSearch(query); onClose(); }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-2 transition-colors",
                      i === activeIndex ? "bg-surface-2" : "hover:bg-surface-2"
                    )}
                  >
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface-inset">
                      <Image src={product.colors[0].images[0]} alt="" fill sizes="56px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{product.name}</span>
                      <span className="block text-xs text-fg-subtle">{product.brandName}</span>
                    </span>
                    <span className="tnum shrink-0 text-sm font-semibold text-fg">
                      {formatAmount(product.price)}
                      <span className="ms-1 text-[0.6875rem] font-normal text-fg-muted">تومان</span>
                    </span>
                  </Link>
                </li>
              ))}
              <li className="pt-2">
                <button type="button" onClick={() => submit(query)}
                  className="w-full rounded-lg border border-border px-4 py-3 text-sm font-medium text-primary hover:bg-surface-2 dark:text-[color:var(--primary-soft-fg)]">
                  دیدن همه نتیجه‌ها برای «{query}»
                </button>
              </li>
            </ul>
          )}

          {showEmpty && (
            <div className="px-4 py-12 text-center">
              <Search className="mx-auto mb-3 size-10 text-fg-subtle" aria-hidden />
              <p className="font-semibold text-fg">نتیجه‌ای برای «{query}» پیدا نشد</p>
              <p className="mt-1.5 text-sm text-fg-muted">املای عبارت را بررسی کنید یا از یکی از جست‌وجوهای پرطرفدار استفاده کنید.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {POPULAR_SEARCHES.slice(0, 4).map((term) => (
                  <button key={term} type="button" onClick={() => { setQuery(term); }}
                    className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-fg-muted hover:text-fg">
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
