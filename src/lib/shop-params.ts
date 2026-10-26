import type { Gender, ProductFilters, ProductTag, SortKey } from "@/types";
import { PRODUCT_GENDERS, PRODUCT_TAGS } from "@/lib/catalog-constants";

/**
 * Filters live in the URL, so every filtered view is shareable, bookmarkable
 * and survives the back button. This module is the single place that knows how
 * to read and write that query string.
 */

export type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const list = (value: string | string[] | undefined): string[] => {
  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw ? raw.split(",").filter(Boolean) : [];
};

const SORT_KEYS: SortKey[] = ["newest", "bestselling", "price-asc", "price-desc", "rating", "discount"];
// Only the genders the shop still offers can be filtered on; a stale
// `?gender=kids` link is ignored rather than producing an empty page.
const GENDERS: readonly Gender[] = PRODUCT_GENDERS;

export function parseFilters(params: RawParams): ProductFilters {
  const sort = first(params.sort) as SortKey | undefined;
  const page = Number(first(params.page) ?? 1);
  const tag = first(params.tag) as ProductTag | undefined;

  return {
    q: first(params.q) || undefined,
    categories: list(params.category),
    genders: list(params.gender).filter((g): g is Gender => GENDERS.includes(g as Gender)),
    brands: list(params.brand),
    sizes: list(params.size).map(Number).filter((n) => !Number.isNaN(n)),
    colors: list(params.color),
    minPrice: first(params.min) ? Number(first(params.min)) : undefined,
    maxPrice: first(params.max) ? Number(first(params.max)) : undefined,
    inStockOnly: first(params.stock) === "1",
    onSaleOnly: first(params.sale) === "1",
    tag: tag && PRODUCT_TAGS.includes(tag) ? tag : undefined,
    sort: sort && SORT_KEYS.includes(sort) ? sort : "newest",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Serialises filters back to a query string, omitting defaults and empties. */
export function buildQuery(filters: ProductFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.categories?.length) params.set("category", filters.categories.join(","));
  if (filters.genders?.length) params.set("gender", filters.genders.join(","));
  if (filters.brands?.length) params.set("brand", filters.brands.join(","));
  if (filters.sizes?.length) params.set("size", filters.sizes.join(","));
  if (filters.colors?.length) params.set("color", filters.colors.join(","));
  if (filters.minPrice != null) params.set("min", String(filters.minPrice));
  if (filters.maxPrice != null) params.set("max", String(filters.maxPrice));
  if (filters.inStockOnly) params.set("stock", "1");
  if (filters.onSaleOnly) params.set("sale", "1");
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** True when anything narrows the catalog (sorting and paging don't count). */
export function hasActiveFilters(filters: ProductFilters): boolean {
  return Boolean(
    filters.q ||
    filters.categories?.length ||
    filters.genders?.length ||
    filters.brands?.length ||
    filters.sizes?.length ||
    filters.colors?.length ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    filters.inStockOnly ||
    filters.onSaleOnly ||
    filters.tag
  );
}

export function countActiveFilters(filters: ProductFilters): number {
  return (
    (filters.categories?.length ?? 0) +
    (filters.genders?.length ?? 0) +
    (filters.brands?.length ?? 0) +
    (filters.sizes?.length ?? 0) +
    (filters.colors?.length ?? 0) +
    (filters.minPrice != null || filters.maxPrice != null ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.onSaleOnly ? 1 : 0) +
    (filters.tag ? 1 : 0)
  );
}

/** Includes the retired values so legacy products still render a label. */
export const GENDER_LABELS: Record<Gender, string> = {
  men: "مردانه",
  women: "زنانه",
  unisex: "یونیسکس",
  kids: "بچگانه",
};

export const TAG_LABELS: Record<ProductTag, string> = {
  new: "جدید",
  bestseller: "پرفروش",
  sale: "حراج",
  limited: "محدود",
};
