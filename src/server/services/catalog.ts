import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { normalizePersian } from "@/lib/persian";
import { siteConfig } from "@/lib/site-config";
import { effectivePricing, type CampaignPricing } from "./pricing";
import type {
  Brand,
  Category,
  Gender,
  PaginatedResult,
  Product,
  ProductColor,
  ProductFilters,
  ProductSummary,
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
    and.push({ compareAtPrice: { not: null } });
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

export async function searchProducts(
  filters: ProductFilters
): Promise<PaginatedResult<ProductSummary>> {
  const pageSize = siteConfig.commerce.productsPerPage;
  const page = Math.max(1, filters.page ?? 1);
  const where = buildWhere(filters);
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

export function getBestSellers(limit = 8): Promise<ProductSummary[]> {
  return listBy({}, [{ soldCount: "desc" }], limit);
}

export function getNewArrivals(limit = 8): Promise<ProductSummary[]> {
  return listBy({}, [{ createdAt: "desc" }], limit);
}

export function getOnSale(limit = 8): Promise<ProductSummary[]> {
  return listBy({ compareAtPrice: { not: null } }, [{ compareAtPrice: "desc" }], limit);
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
    productCount: row._count.products,
  }));
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const row = await prisma.category.findFirst({
    where: { slug, active: true },
    include: { _count: { select: { products: true } } },
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    image: row.image ?? undefined,
    featured: row.featured,
    productCount: row._count.products,
  };
}

export async function listBrands(): Promise<Brand[]> {
  const rows = await prisma.brand.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name }));
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

/** Product counts per category id, for the category tiles and admin list. */
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
