import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { normalizePersian } from "@/lib/persian";
import { siteConfig } from "@/lib/site-config";
import { effectivePricing, type CampaignPricing } from "./pricing";
import { categoryAncestors, descendantIds } from "@/lib/category-tree";
import type {
  Brand,
  Category,
  Gender,
  PaginatedResult,
  Product,
  ProductColor,
  ProductFilters,
  ProductSummary,
  ProductTag,
  ProductVariant,
  SortKey,
} from "@/types";

/**
 * Catalogue reads.
 *
 * Every storefront surface that shows a product goes through here. The
 * functions return the same `ProductSummary` / `Category` shapes the UI has
 * always rendered, so the components did not have to change when the data moved
 * from a JSON file to PostgreSQL.
 *
 * `server-only` is load-bearing: importing this from a client component is a
 * build error, which is what keeps the catalogue out of the browser bundle.
 */

/* ----------------------------------------------------------------- shapes -- */

const productInclude = {
  brand: true,
  categories: { include: { category: true } },
  colors: { include: { color: true }, orderBy: { position: "asc" } },
  variants: { include: { size: true }, orderBy: { sizeId: "asc" } },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function toProductColor(row: ProductRow["colors"][number]): ProductColor {
  return {
    id: row.colorId,
    name: row.color.name,
    hex: row.color.hex,
    hexSecondary: row.color.hexSecondary ?? undefined,
    images: row.images,
  };
}

function toVariant(row: ProductRow["variants"][number]): ProductVariant {
  return {
    id: row.id,
    sku: row.sku,
    colorId: row.colorId,
    size: row.size.value,
    stock: row.stock,
    price: row.price ?? undefined,
    compareAtPrice: row.compareAtPrice ?? undefined,
  };
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle ?? undefined,
    brandId: row.brandId,
    categoryIds: row.categories.map((c) => c.categoryId),
    gender: row.gender as Gender,
    price: row.price,
    compareAtPrice: row.compareAtPrice ?? undefined,
    colors: row.colors.map(toProductColor),
    variants: row.variants.filter((v) => v.active).map(toVariant),
    description: row.description,
    features: row.features,
    specs: (row.specs as { label: string; value: string }[]) ?? [],
    rating: row.rating,
    reviewCount: row.reviewCount,
    soldCount: row.soldCount,
    tags: row.tags as Product["tags"],
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Adds the computed fields every product surface needs.
 *
 * The effective price accounts for any live campaign, so a campaign discount is
 * visible on the storefront and — critically — is the same number the checkout
 * recomputes server-side. The browser never decides a price.
 */
export function toSummary(row: ProductRow, campaigns?: CampaignPricing): ProductSummary {
  const product = toProduct(row);
  const totalStock = row.variants.reduce((n, v) => n + (v.active ? v.stock : 0), 0);
  const pricing = effectivePricing(
    { id: row.id, price: row.price, compareAtPrice: row.compareAtPrice },
    campaigns
  );

  return {
    ...product,
    price: pricing.price,
    compareAtPrice: pricing.compareAtPrice ?? undefined,
    brandName: row.brand.name,
    discountPercent: pricing.discountPercent,
    inStock: totalStock > 0,
    totalStock,
  };
}

/* ------------------------------------------------------------- filtering -- */

/**
 * Translates the UI's filters into a Prisma `where`.
 *
 * Size and colour mean "available in this size/colour", so they are answered
 * from the variants rather than the product's own columns — the same rule the
 * storefront has always used.
 */
function buildWhere(filters: ProductFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { active: true };
  const and: Prisma.ProductWhereInput[] = [];

  if (filters.q) {
    const normalized = normalizePersian(filters.q);
    // Every word must appear somewhere, which narrows results as the customer
    // types. Each term is a trigram-indexed substring match.
    for (const word of normalized.split(" ").filter(Boolean)) {
      and.push({ searchText: { contains: word } });
    }
  }

  if (filters.categories?.length) {
    and.push({ categories: { some: { category: { slug: { in: filters.categories } } } } });
  }
  if (filters.genders?.length) {
    where.gender = { in: filters.genders as Gender[] };
  }
  if (filters.brands?.length) {
    and.push({ brand: { slug: { in: filters.brands } } });
  }
  if (filters.minPrice != null || filters.maxPrice != null) {
    where.price = {
      ...(filters.minPrice != null ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice != null ? { lte: filters.maxPrice } : {}),
    };
  }
  if (filters.onSaleOnly) {
    // "On sale" is either a real markdown or the admin's «حراج» badge — the
    // same rule the homepage discount section uses.
    and.push({ OR: [{ compareAtPrice: { not: null } }, { tags: { has: "sale" } }] });
  }
  if (filters.tag) {
    and.push({ tags: { has: filters.tag } });
  }

  // Size, colour and stock all resolve against the variant table. When several
  // are set they must be satisfied by the *same* variant, otherwise a product
  // with size 42 in black and size 40 in white would wrongly match
  // "size 42 + white".
  const variantWhere: Prisma.ProductVariantWhereInput = { active: true };
  let hasVariantFilter = false;
  if (filters.sizes?.length) {
    variantWhere.size = { value: { in: filters.sizes } };
    hasVariantFilter = true;
  }
  if (filters.colors?.length) {
    variantWhere.colorId = { in: filters.colors };
    hasVariantFilter = true;
  }
  if (filters.inStockOnly) {
    variantWhere.stock = { gt: 0 };
    hasVariantFilter = true;
  }
  if (hasVariantFilter) and.push({ variants: { some: variantWhere } });

  if (and.length) where.AND = and;
  return where;
}

const ORDER_BY: Record<SortKey, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  bestselling: [{ soldCount: "desc" }],
  "price-asc": [{ price: "asc" }],
  "price-desc": [{ price: "desc" }],
  rating: [{ rating: "desc" }, { reviewCount: "desc" }],
  // Cheapest-relative-to-compare-at is not expressible as a column sort, so
  // the discounted products are surfaced first and ordered by headline saving.
  discount: [{ compareAtPrice: "desc" }, { price: "asc" }],
};

/**
 * A category filter means "this category or anything under it": the page of
 * a top-level category lists its subcategories' products too.
 */
async function expandCategorySlugs(slugs: string[] | undefined): Promise<string[] | undefined> {
  if (!slugs?.length) return slugs;
  const rows = await prisma.category.findMany({ select: { id: true, slug: true, parentId: true } });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const slugById = new Map(rows.map((r) => [r.id, r.slug]));
  const out = new Set<string>();
  for (const slug of slugs) {
    const row = bySlug.get(slug);
    if (!row) { out.add(slug); continue; }
    for (const id of descendantIds(rows, row.id)) out.add(slugById.get(id)!);
  }
  return [...out];
}

export async function searchProducts(
  filters: ProductFilters
): Promise<PaginatedResult<ProductSummary>> {
  const pageSize = siteConfig.commerce.productsPerPage;
  const page = Math.max(1, filters.page ?? 1);
  const where = buildWhere({ ...filters, categories: await expandCategorySlugs(filters.categories) });
  const orderBy = ORDER_BY[filters.sort ?? "newest"] ?? ORDER_BY.newest;

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      include: productInclude,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const campaigns = await loadCampaignPricing(rows.map((r) => r.id));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items: rows.map((row) => toSummary(row, campaigns)),
    total,
    page: Math.min(page, totalPages),
    pageSize,
    totalPages,
  };
}

export async function getProduct(slug: string): Promise<ProductSummary | null> {
  const row = await prisma.product.findFirst({
    where: { slug, active: true },
    include: productInclude,
  });
  if (!row) return null;
  return toSummary(row, await loadCampaignPricing([row.id]));
}

/** Admin variant: reaches inactive products too. */
export async function getProductForAdmin(idOrSlug: string): Promise<ProductRow | null> {
  return prisma.product.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: productInclude,
  });
}

export async function getAllProductSlugs(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { active: true },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}

async function listBy(
  where: Prisma.ProductWhereInput,
  orderBy: Prisma.ProductOrderByWithRelationInput[],
  limit: number
): Promise<ProductSummary[]> {
  const rows = await prisma.product.findMany({
    where: { active: true, ...where },
    orderBy,
    include: productInclude,
    take: limit,
  });
  const campaigns = await loadCampaignPricing(rows.map((r) => r.id));
  return rows.map((row) => toSummary(row, campaigns));
}

/*
 * The homepage sections are driven by the badges an administrator puts on a
 * product (`tags`), so tagging a product «جدید» is what puts it in «تازه رسیده».
 *
 * Only when *no* active product carries a badge does a section fall back to
 * the metric it is named after (newest, most sold), so a fresh catalogue never
 * shows an empty block. As soon as one product is tagged, the section shows
 * exactly the tagged products.
 */

async function listTagged(
  tag: ProductTag,
  orderBy: Prisma.ProductOrderByWithRelationInput[],
  limit: number,
  fallback?: { where: Prisma.ProductWhereInput; fill: boolean }
): Promise<ProductSummary[]> {
  const tagged = await listBy({ tags: { has: tag } }, orderBy, limit);
  if (!fallback) return tagged;
  if (tagged.length && !fallback.fill) return tagged;
  if (tagged.length >= limit) return tagged;

  const rest = await listBy(
    { AND: [fallback.where, { id: { notIn: tagged.map((p) => p.id) } }] },
    orderBy,
    limit - tagged.length
  );
  return [...tagged, ...rest];
}

/** «پرفروش» — products badged best seller, best-selling first. */
export function getBestSellers(limit = 8): Promise<ProductSummary[]> {
  return listTagged("bestseller", [{ soldCount: "desc" }, { createdAt: "desc" }], limit, {
    where: {},
    fill: false,
  });
}

/** «تازه رسیده» — products badged new, newest first. */
export function getNewArrivals(limit = 8): Promise<ProductSummary[]> {
  return listTagged("new", [{ createdAt: "desc" }], limit, { where: {}, fill: false });
}

/**
 * «تخفیف» — products badged sale first, then any other product that is
 * actually marked down. Prices are never touched here: a card shows the
 * product's own effective price (compare-at and live campaigns), the same
 * number the checkout charges.
 */
export function getOnSale(limit = 8): Promise<ProductSummary[]> {
  return listTagged(
    "sale",
    [{ compareAtPrice: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    limit,
    { where: { compareAtPrice: { not: null } }, fill: true }
  );
}

/** Same category first, then anything else, never the product itself. */
export async function getRelatedProducts(
  product: Pick<Product, "id" | "categoryIds">,
  limit = 8
): Promise<ProductSummary[]> {
  const sameCategory = await listBy(
    {
      id: { not: product.id },
      categories: { some: { categoryId: { in: product.categoryIds } } },
    },
    [{ soldCount: "desc" }],
    limit
  );
  if (sameCategory.length >= limit) return sameCategory;

  const exclude = [product.id, ...sameCategory.map((p) => p.id)];
  const fallback = await listBy({ id: { notIn: exclude } }, [{ soldCount: "desc" }], limit - sameCategory.length);
  return [...sameCategory, ...fallback];
}

/** Top suggestions for the header search overlay. */
export async function getSearchSuggestions(query: string, limit = 6): Promise<ProductSummary[]> {
  if (!query.trim()) return [];
  const result = await searchProducts({ q: query, sort: "bestselling", page: 1 });
  return result.items.slice(0, limit);
}

/* ------------------------------------------------------------ categories -- */

export async function listCategories(options: { includeInactive?: boolean } = {}): Promise<Category[]> {
  const rows = await prisma.category.findMany({
    where: options.includeInactive ? {} : { active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    image: row.image ?? undefined,
    featured: row.featured,
    active: row.active,
    position: row.position,
    parentId: row.parentId ?? undefined,
    productCount: row._count.products,
  }));
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return (await getCategoryFamily(slug))?.category ?? null;
}

/**
 * A storefront category with its place in the tree: the ancestors for the
 * breadcrumb and the visible subcategories for the chips under the heading.
 * A category under a hidden parent is hidden too.
 */
export async function getCategoryFamily(slug: string): Promise<{
  category: Category;
  ancestors: Category[];
  children: Category[];
} | null> {
  const all = await listCategories();
  const category = all.find((c) => c.slug === slug);
  if (!category) return null;
  // `all` holds visible categories only, so a hidden ancestor breaks the chain.
  const visible = new Set(all.map((c) => c.id));
  for (let parent = category.parentId, hops = 0; parent; hops++) {
    if (!visible.has(parent) || hops > 20) return null;
    parent = all.find((c) => c.id === parent)?.parentId;
  }
  const ancestors = categoryAncestors(all, category.id);
  return { category, ancestors, children: all.filter((c) => c.parentId === category.id) };
}

/** Active collections, in the order the administrator set. */
export async function listBrands(): Promise<Brand[]> {
  const rows = await prisma.brand.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: { where: { active: true } } } } },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    image: row.image ?? undefined,
    productCount: row._count.products,
  }));
}

export const listCollections = listBrands;

export async function getCollectionBySlug(slug: string): Promise<Brand | null> {
  const row = await prisma.brand.findFirst({
    where: { slug, active: true },
    include: { _count: { select: { products: { where: { active: true } } } } },
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    image: row.image ?? undefined,
    productCount: row._count.products,
  };
}

/**
 * One representative image per collection / category, for cards whose
 * administrator has not uploaded one yet: the first photo of the
 * best-selling active product in it.
 */
export async function getCollectionCoverImages(ids: string[]): Promise<Map<string, string>> {
  return coverImages(ids.map((id) => ({ id, where: { brandId: id } })));
}

export async function getCategoryCoverImages(ids: string[]): Promise<Map<string, string>> {
  return coverImages(ids.map((id) => ({ id, where: { categories: { some: { categoryId: id } } } })));
}

async function coverImages(
  targets: { id: string; where: Prisma.ProductWhereInput }[]
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    targets.map(async ({ id, where }) => {
      const row = await prisma.product.findFirst({
        where: { active: true, ...where, colors: { some: { images: { isEmpty: false } } } },
        orderBy: { soldCount: "desc" },
        select: {
          colors: {
            where: { images: { isEmpty: false } },
            orderBy: { position: "asc" },
            take: 1,
            select: { images: true },
          },
        },
      });
      return [id, row?.colors[0]?.images[0]] as const;
    })
  );
  return new Map(entries.filter((e): e is readonly [string, string] => Boolean(e[1])));
}

/* ---------------------------------------------------------------- facets -- */

export interface Facets {
  colors: { id: string; name: string; hex: string; count: number }[];
  sizes: { size: number; count: number }[];
  genders: { gender: string; count: number }[];
  priceRange: { min: number; max: number };
}

/**
 * Filter facets, answered by aggregate queries.
 *
 * These used to be computed by walking the whole catalogue in memory. Each one
 * is now a grouped count in PostgreSQL, so the cost does not grow with the
 * number of products the browser never sees.
 */
export async function getFacets(): Promise<Facets> {
  const [colorRows, sizeRows, genderRows, priceRow] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string; hex: string; count: bigint }[]>`
      SELECT c.id, c.name, c.hex, COUNT(DISTINCT pc."productId")::bigint AS count
      FROM colors c
      JOIN product_colors pc ON pc."colorId" = c.id
      JOIN products p ON p.id = pc."productId" AND p.active
      WHERE c.active
      GROUP BY c.id, c.name, c.hex
      ORDER BY count DESC
    `,
    prisma.$queryRaw<{ size: number; count: bigint }[]>`
      SELECT s.value AS size, COUNT(DISTINCT v."productId")::bigint AS count
      FROM sizes s
      JOIN product_variants v ON v."sizeId" = s.id AND v.active
      JOIN products p ON p.id = v."productId" AND p.active
      WHERE s.active
      GROUP BY s.value
      ORDER BY s.value ASC
    `,
    prisma.product.groupBy({
      by: ["gender"],
      where: { active: true },
      _count: { _all: true },
    }),
    prisma.product.aggregate({
      where: { active: true },
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  return {
    colors: colorRows.map((r) => ({ id: r.id, name: r.name, hex: r.hex, count: Number(r.count) })),
    sizes: sizeRows.map((r) => ({ size: Number(r.size), count: Number(r.count) })),
    genders: genderRows.map((r) => ({ gender: r.gender, count: r._count._all })),
    priceRange: { min: priceRow._min.price ?? 0, max: priceRow._max.price ?? 0 },
  };
}

/**
 * Distinct active products per category *including its subcategories* — what a
 * storefront tile or menu promises the customer will find behind the link.
 */
export async function getCategorySubtreeCounts(): Promise<Map<string, number>> {
  const [categories, links] = await Promise.all([
    prisma.category.findMany({ select: { id: true, parentId: true } }),
    prisma.productCategory.findMany({
      where: { product: { active: true } },
      select: { productId: true, categoryId: true },
    }),
  ]);
  const productsOf = new Map<string, Set<string>>();
  for (const link of links) {
    const set = productsOf.get(link.categoryId) ?? new Set<string>();
    set.add(link.productId);
    productsOf.set(link.categoryId, set);
  }
  const counts = new Map<string, number>();
  for (const category of categories) {
    const all = new Set<string>();
    for (const id of descendantIds(categories, category.id)) {
      for (const productId of productsOf.get(id) ?? []) all.add(productId);
    }
    counts.set(category.id, all.size);
  }
  return counts;
}

/** Products directly in each category (not its subcategories), for the admin. */
export async function getCategoryCounts(): Promise<Map<string, number>> {
  const rows = await prisma.productCategory.groupBy({
    by: ["categoryId"],
    where: { product: { active: true } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.categoryId, r._count._all]));
}

/* ------------------------------------------------------------- campaigns -- */

/**
 * Loads live campaign pricing for a set of products in one query.
 *
 * Returning a map keyed by product id keeps the N+1 out of the list surfaces:
 * one query per page of results, not one per product.
 */
export async function loadCampaignPricing(productIds: string[]): Promise<CampaignPricing> {
  if (!productIds.length) return new Map();
  const now = new Date();

  const rows = await prisma.campaignProduct.findMany({
    where: {
      productId: { in: productIds },
      campaign: {
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
    },
    include: { campaign: true },
  });

  const map: CampaignPricing = new Map();
  for (const row of rows) {
    const current = map.get(row.productId);
    // Highest priority wins; ties break on whichever was created later.
    if (!current || row.campaign.priority > current.priority) {
      map.set(row.productId, {
        id: row.campaign.id,
        name: row.campaign.name,
        type: row.campaign.type,
        value: row.campaign.value,
        maxDiscount: row.campaign.maxDiscount,
        priority: row.campaign.priority,
      });
    }
  }
  return map;
}
