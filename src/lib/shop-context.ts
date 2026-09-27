import type { ProductFilters } from "@/types";

/**
 * Route-imposed filters.
 *
 * `/category/kids` and `/sale` are not "the shop with a checkbox ticked" — the
 * route itself *is* the constraint. Rendering that constraint as an ordinary
 * checkbox produces a control that either does nothing or silently contradicts
 * the URL, which is what this module exists to prevent.
 *
 * The rules, in one place:
 *
 *  - A route-imposed filter is shown as a locked context pill, never as a
 *    checkbox the customer can uncheck in place.
 *  - It is never written into the query string, so the pathname and the query
 *    can never disagree (`/category/kids?category=kids` is not a state that can
 *    be reached, and neither is `/category/kids?category=men`).
 *  - Every other filter stays fully editable.
 *  - Leaving the constraint is an explicit navigation — "view all products" to
 *    `/shop`, or picking a different category, which navigates to that
 *    category's route carrying the customer's other filters along.
 */

export type ShopContextKind = "category" | "sale";

export interface ShopContext {
  kind: ShopContextKind;
  /** The value the route pins, e.g. the category slug. */
  value?: string;
  /** Shown inside the locked pill, e.g. «دسته‌بندی: بچگانه». */
  label: string;
  /** Label for the action that drops the constraint. */
  escapeLabel: string;
  escapeHref: string;
}

export function categoryContext(slug: string, name: string): ShopContext {
  return {
    kind: "category",
    value: slug,
    label: `دسته‌بندی: ${name}`,
    escapeLabel: "مشاهده همه محصولات",
    escapeHref: "/shop",
  };
}

export const saleContext: ShopContext = {
  kind: "sale",
  label: "فقط محصولات تخفیف‌دار",
  escapeLabel: "مشاهده همه محصولات",
  escapeHref: "/shop",
};

/**
 * Strips whatever the route already pins from the filters before they are
 * serialised. Without this, `/category/kids` would carry a redundant
 * `?category=kids` that a customer could then edit into a contradiction.
 */
export function stripContext(filters: ProductFilters, context?: ShopContext): ProductFilters {
  if (!context) return filters;
  if (context.kind === "category") {
    const rest = (filters.categories ?? []).filter((slug) => slug !== context.value);
    return { ...filters, categories: rest.length ? rest : undefined };
  }
  // `/sale` means onSale, so the flag is implied by the path.
  return { ...filters, onSaleOnly: undefined };
}

/** Re-applies the route constraint to filters read from the query string. */
export function applyContext(filters: ProductFilters, context?: ShopContext): ProductFilters {
  if (!context) return filters;
  if (context.kind === "category") {
    const slugs = new Set(filters.categories ?? []);
    if (context.value) slugs.add(context.value);
    return { ...filters, categories: [...slugs] };
  }
  return { ...filters, onSaleOnly: true };
}

/**
 * Where picking category `slug` should take the customer from the current
 * route. Selecting a different top-level category is a navigation, not a
 * contradictory piece of state layered onto the existing path.
 */
export function categoryHref(slug: string, query: string): string {
  return `/category/${slug}${query}`;
}
