"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Accordion } from "@/components/ui/Navigation";
import { formatAmount, toPersianDigits } from "@/lib/format";
import { GENDER_LABELS } from "@/lib/shop-params";
import type { ShopContext } from "@/lib/shop-context";
import { cn } from "@/lib/utils";
import type { Gender, ProductFilters } from "@/types";
import type { Brand, Category } from "@/types";

export interface FacetData {
  colors: { id: string; name: string; hex: string; count: number }[];
  sizes: { size: number; count: number }[];
  genders: { gender: string; count: number }[];
  priceRange: { min: number; max: number };
}

/**
 * The filter controls, shared by the desktop sidebar and the mobile bottom
 * sheet so the two can never drift apart.
 *
 * Changes are applied through `onChange` — the parent decides whether that
 * means an immediate URL push (desktop) or a staged "apply" (mobile sheet).
 *
 * `context` marks a filter the *route* imposes. Two things change when it is
 * set, both to stop a route constraint masquerading as a broken control:
 *
 *  - On a category route the category checkboxes become links. Ticking a box
 *    that the path already forces would do nothing, and unticking it would
 *    contradict the URL; choosing a different category is a navigation.
 *  - On `/sale` the "discounted only" toggle is withdrawn, because the route
 *    already guarantees it. The locked pill above says so.
 */
export function FilterPanel({
  filters, facets, categories, brands, onChange, className, context, buildCategoryHref,
}: {
  filters: ProductFilters;
  facets: FacetData;
  categories: Category[];
  brands: Brand[];
  onChange: (next: ProductFilters) => void;
  className?: string;
  context?: ShopContext;
  /** Required when `context.kind === "category"` — see above. */
  buildCategoryHref?: (slug: string) => string;
}) {
  const categoryLocked = context?.kind === "category";
  const saleLocked = context?.kind === "sale";
  const [minPrice, setMinPrice] = useState(filters.minPrice?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice?.toString() ?? "");

  useEffect(() => {
    setMinPrice(filters.minPrice?.toString() ?? "");
    setMaxPrice(filters.maxPrice?.toString() ?? "");
  }, [filters.minPrice, filters.maxPrice]);

  /** Adds or removes one value from an array-valued filter. */
  const toggle = <K extends keyof ProductFilters>(key: K, value: string | number) => {
    const current = (filters[key] as (string | number)[] | undefined) ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ ...filters, [key]: next, page: 1 });
  };

  const applyPrice = () => {
    onChange({
      ...filters,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      page: 1,
    });
  };

  const sizeGroups = [
    { label: "بچگانه", sizes: facets.sizes.filter((s) => s.size < 36) },
    { label: "بزرگسال", sizes: facets.sizes.filter((s) => s.size >= 36) },
  ].filter((g) => g.sizes.length);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Quick toggles stay outside the accordion — they're the most used. */}
      <div className="space-y-1 rounded-lg border border-border bg-surface p-3">
        <Checkbox
          label="فقط کالاهای موجود"
          checked={!!filters.inStockOnly}
          onChange={(e) => onChange({ ...filters, inStockOnly: e.target.checked, page: 1 })}
        />
        {/* On /sale the route already guarantees this, so showing it as an
            editable toggle would be a control that cannot be turned off. */}
        {!saleLocked && (
          <Checkbox
            label="فقط تخفیف‌دارها"
            checked={!!filters.onSaleOnly}
            onChange={(e) => onChange({ ...filters, onSaleOnly: e.target.checked, page: 1 })}
          />
        )}
      </div>

      <Accordion
        defaultOpen="category"
        items={[
          {
            id: "category",
            title: categoryLocked ? "رفتن به دسته‌بندی دیگر" : "دسته‌بندی",
            content: categoryLocked ? (
              <div className="-my-0.5">
                {categories.map((category) => {
                  const current = category.slug === context?.value;
                  return (
                    <Link
                      key={category.id}
                      href={current ? "#" : buildCategoryHref?.(category.slug) ?? `/category/${category.slug}`}
                      aria-current={current ? "page" : undefined}
                      // The category already in force is inert rather than a
                      // link back to the page the customer is already on.
                      aria-disabled={current || undefined}
                      onClick={current ? (e) => e.preventDefault() : undefined}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-2 rounded-md px-2 text-sm transition-colors",
                        current
                          ? "cursor-default bg-primary-soft font-medium text-fg"
                          : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                      )}
                    >
                      <span className="truncate">{category.name}</span>
                      {current && <Check className="size-4 shrink-0 text-primary-soft-fg" aria-hidden />}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="-my-1">
                {categories.map((category) => (
                  <Checkbox
                    key={category.id}
                    label={category.name}
                    checked={filters.categories?.includes(category.slug) ?? false}
                    onChange={() => toggle("categories", category.slug)}
                  />
                ))}
              </div>
            ),
          },
          {
            id: "gender",
            title: "جنسیت",
            content: (
              <div className="-my-1">
                {facets.genders.map(({ gender, count }) => (
                  <Checkbox
                    key={gender}
                    label={GENDER_LABELS[gender as Gender]}
                    count={count}
                    checked={filters.genders?.includes(gender as Gender) ?? false}
                    onChange={() => toggle("genders", gender)}
                  />
                ))}
              </div>
            ),
          },
          {
            id: "size",
            title: "سایز",
            content: (
              <div className="space-y-4">
                {sizeGroups.map((group) => (
                  <div key={group.label}>
                    <p className="mb-2 text-xs font-medium text-fg-subtle">{group.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.sizes.map(({ size }) => {
                        const active = filters.sizes?.includes(size) ?? false;
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => toggle("sizes", size)}
                            aria-pressed={active}
                            className={cn(
                              "tnum grid h-11 min-w-11 place-items-center rounded-md border px-2 text-sm font-medium transition-colors",
                              active
                                ? "border-primary bg-primary text-primary-fg"
                                : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
                            )}
                          >
                            {toPersianDigits(size)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: "color",
            title: "رنگ",
            content: (
              <div className="grid grid-cols-2 gap-1">
                {facets.colors.map((color) => {
                  const active = filters.colors?.includes(color.id) ?? false;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => toggle("colors", color.id)}
                      aria-pressed={active}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-md border px-2 text-sm transition-colors",
                        active ? "border-primary bg-primary-soft text-fg" : "border-transparent text-fg-muted hover:bg-surface-2"
                      )}
                    >
                      <span
                        aria-hidden
                        className="size-5 shrink-0 rounded-full border border-border"
                        style={{ background: color.hex }}
                      />
                      <span className="truncate">{color.name}</span>
                    </button>
                  );
                })}
              </div>
            ),
          },
          {
            id: "price",
            title: "محدوده قیمت",
            content: (
              <div className="space-y-3">
                <p className="text-xs text-fg-subtle">
                  قیمت محصولات از {formatAmount(facets.priceRange.min)} تا {formatAmount(facets.priceRange.max)} تومان
                </p>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor="price-min" className="mb-1 block text-xs text-fg-muted">از (تومان)</label>
                    <input
                      id="price-min"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder={String(facets.priceRange.min)}
                      className="tnum h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    />
                  </div>
                  <span aria-hidden className="pb-3 text-fg-subtle">—</span>
                  <div className="flex-1">
                    <label htmlFor="price-max" className="mb-1 block text-xs text-fg-muted">تا (تومان)</label>
                    <input
                      id="price-max"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder={String(facets.priceRange.max)}
                      className="tnum h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    />
                  </div>
                </div>
                <Button variant="secondary" size="sm" fullWidth onClick={applyPrice}>
                  اعمال محدوده قیمت
                </Button>
              </div>
            ),
          },
          {
            id: "brand",
            title: "کالکشن",
            content: (
              <div className="-my-1">
                {brands.map((brand) => (
                  <Checkbox
                    key={brand.id}
                    label={brand.name}
                    checked={filters.brands?.includes(brand.slug) ?? false}
                    onChange={() => toggle("brands", brand.slug)}
                  />
                ))}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
