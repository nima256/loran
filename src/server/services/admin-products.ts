import "server-only";
import { Prisma, type Gender } from "@prisma/client";
import { prisma, type Db } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { paginated, paginationArgs, type Pagination } from "../lib/validation";
import { normalizePersian } from "@/lib/persian";

/**
 * Product authoring.
 *
 * The editor writes a whole product in one go — identity, categories,
 * colourways with their galleries, and the variant matrix — so everything lands
 * in a single transaction and a half-written product is never visible.
 *
 * Two invariants are enforced here rather than trusted from the form:
 *  - no duplicate (product, colour, size) variant, which is also a database
 *    unique constraint;
 *  - a variant is never hard-deleted while order history points at it.
 */

/* -------------------------------------------------------------------------- */
/* Search index                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Builds the normalised haystack the storefront search matches against.
 *
 * Recomputed on every write so the index can never drift from the product.
 */
export function buildSearchText(input: {
  name: string;
  subtitle?: string | null;
  brandName: string;
  colorNames: string[];
  categoryNames: string[];
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
}): string {
  return normalizePersian(
    [
      input.name,
      input.subtitle ?? "",
      input.brandName,
      ...input.colorNames,
      ...input.categoryNames,
      input.description,
      ...input.features,
      ...input.specs.map((s) => `${s.label} ${s.value}`),
    ].join(" ")
  );
}

async function refreshSearchText(db: Db, productId: string): Promise<void> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      brand: true,
      colors: { include: { color: true } },
      categories: { include: { category: true } },
    },
  });
  if (!product) return;

  await db.product.update({
    where: { id: productId },
    data: {
      searchText: buildSearchText({
        name: product.name,
        subtitle: product.subtitle,
        brandName: product.brand.name,
        colorNames: product.colors.map((c) => c.color.name),
        categoryNames: product.categories.map((c) => c.category.name),
        description: product.description,
        features: product.features,
        specs: (product.specs as { label: string; value: string }[]) ?? [],
      }),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

export interface ProductColorInput {
  colorId: string;
  images: string[];
}

export interface ProductVariantInput {
  /** Present when editing an existing variant. */
  id?: string;
  colorId: string;
  /** EU size value, not the Size row id — the editor works in sizes. */
  size: number;
  sku?: string;
  stock: number;
  price?: number | null;
  compareAtPrice?: number | null;
  active?: boolean;
}

export interface ProductInput {
  name: string;
  slug: string;
  subtitle?: string;
  brandId: string;
  categoryIds: string[];
  gender: Gender;
  price: number;
  compareAtPrice?: number | null;
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
  tags: string[];
  active: boolean;
  colors: ProductColorInput[];
  variants: ProductVariantInput[];
}

/** Rejects anything the database constraints would only catch later, with a
 *  message that names the actual problem. */
function assertCoherent(input: ProductInput) {
  if (!input.colors.length) {
    throw badRequest("حداقل یک رنگ برای محصول لازم است.");
  }
  if (!input.categoryIds.length) {
    throw badRequest("حداقل یک دسته‌بندی برای محصول انتخاب کنید.");
  }
  if (input.compareAtPrice != null && input.compareAtPrice <= input.price) {
    throw badRequest("قیمت قبل از تخفیف باید بیشتر از قیمت فعلی باشد.");
  }

  const colorIds = new Set<string>();
  for (const color of input.colors) {
    if (colorIds.has(color.colorId)) {
      throw badRequest("هر رنگ فقط یک بار می‌تواند به محصول اضافه شود.");
    }
    colorIds.add(color.colorId);
  }

  const seen = new Set<string>();
  for (const variant of input.variants) {
    if (!colorIds.has(variant.colorId)) {
      throw badRequest("یکی از تنوع‌ها به رنگی اشاره می‌کند که در محصول تعریف نشده است.");
    }
    const key = `${variant.colorId}:${variant.size}`;
    if (seen.has(key)) {
      throw conflict("برای هر ترکیب رنگ و سایز فقط یک تنوع می‌تواند وجود داشته باشد.");
    }
    seen.add(key);
    if (variant.stock < 0) throw badRequest("موجودی نمی‌تواند منفی باشد.");
  }
}

/** Resolves EU size numbers to Size rows, creating any that are missing. */
async function resolveSizeIds(db: Db, sizes: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(sizes)];
  const existing = await db.size.findMany({ where: { value: { in: unique } } });
  const map = new Map(existing.map((s) => [s.value, s.id]));

  for (const value of unique) {
    if (map.has(value)) continue;
    const created = await db.size.create({
      data: { value, label: String(value), position: value },
    });
    map.set(value, created.id);
  }
  return map;
}

function skuFor(slug: string, colorId: string, size: number, provided?: string): string {
  if (provided?.trim()) return provided.trim().toUpperCase();
  const base = slug.replace(/[^\w-]/g, "").toUpperCase().slice(0, 18) || "LRN";
  const color = colorId.replace(/^col-/, "").toUpperCase().slice(0, 4);
  return `${base}-${color}-${size}`;
}

/* -------------------------------------------------------------------------- */
/* Create / update                                                             */
/* -------------------------------------------------------------------------- */

export async function createProduct(input: ProductInput): Promise<{ id: string; slug: string }> {
  assertCoherent(input);

  const clash = await prisma.product.findUnique({ where: { slug: input.slug } });
  if (clash) throw conflict("محصولی با این نشانی (slug) از قبل وجود دارد.");

  return prisma.$transaction(async (tx) => {
    const sizeIds = await resolveSizeIds(tx, input.variants.map((v) => v.size));

    const product = await tx.product.create({
      data: {
        slug: input.slug,
        name: input.name,
        subtitle: input.subtitle ?? null,
        brandId: input.brandId,
        gender: input.gender,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        description: input.description,
        features: input.features,
        specs: input.specs as unknown as Prisma.InputJsonValue,
        tags: input.tags,
        active: input.active,
        categories: { create: input.categoryIds.map((categoryId) => ({ categoryId })) },
        colors: {
          create: input.colors.map((color, index) => ({
            colorId: color.colorId,
            images: color.images,
            position: index,
          })),
        },
      },
      include: { colors: true },
    });

    const colorRowId = new Map(product.colors.map((c) => [c.colorId, c.id]));

    for (const variant of input.variants) {
      await tx.productVariant.create({
        data: {
          productId: product.id,
          productColorId: colorRowId.get(variant.colorId)!,
          colorId: variant.colorId,
          sizeId: sizeIds.get(variant.size)!,
          sku: skuFor(input.slug, variant.colorId, variant.size, variant.sku),
          stock: variant.stock,
          price: variant.price ?? null,
          compareAtPrice: variant.compareAtPrice ?? null,
          active: variant.active ?? true,
        },
      });
    }

    await refreshSearchText(tx, product.id);
    return { id: product.id, slug: product.slug };
  });
}

export async function updateProduct(
  productId: string,
  input: ProductInput
): Promise<{ id: string; slug: string }> {
  assertCoherent(input);

  const existing = await prisma.product.findUnique({
    where: { id: productId },
    include: { colors: true, variants: true },
  });
  if (!existing) throw notFound("محصول پیدا نشد.");

  if (input.slug !== existing.slug) {
    const clash = await prisma.product.findUnique({ where: { slug: input.slug } });
    if (clash) throw conflict("محصولی با این نشانی (slug) از قبل وجود دارد.");
  }

  return prisma.$transaction(async (tx) => {
    const sizeIds = await resolveSizeIds(tx, input.variants.map((v) => v.size));

    await tx.product.update({
      where: { id: productId },
      data: {
        slug: input.slug,
        name: input.name,
        subtitle: input.subtitle ?? null,
        brandId: input.brandId,
        gender: input.gender,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        description: input.description,
        features: input.features,
        specs: input.specs as unknown as Prisma.InputJsonValue,
        tags: input.tags,
        active: input.active,
      },
    });

    /* --- categories: replaced wholesale ------------------------------- */
    await tx.productCategory.deleteMany({ where: { productId } });
    await tx.productCategory.createMany({
      data: input.categoryIds.map((categoryId) => ({ productId, categoryId })),
      skipDuplicates: true,
    });

    /* --- colourways ---------------------------------------------------- */
    const keptColorIds = new Set(input.colors.map((c) => c.colorId));
    for (const stale of existing.colors) {
      if (keptColorIds.has(stale.colorId)) continue;
      // Removing a colourway would orphan its variants, and those variants may
      // be referenced by past orders — so it is refused rather than cascading.
      const used = existing.variants.some((v) => v.colorId === stale.colorId);
      if (used) {
        const inOrders = await tx.orderItem.count({
          where: { variant: { productId, colorId: stale.colorId } },
        });
        if (inOrders > 0) {
          throw conflict(
            "این رنگ در سفارش‌های ثبت‌شده استفاده شده و قابل حذف نیست. می‌توانید تنوع‌های آن را غیرفعال کنید."
          );
        }
        await tx.productVariant.deleteMany({ where: { productId, colorId: stale.colorId } });
      }
      await tx.productColor.delete({ where: { id: stale.id } });
    }

    for (const [index, color] of input.colors.entries()) {
      await tx.productColor.upsert({
        where: { productId_colorId: { productId, colorId: color.colorId } },
        create: { productId, colorId: color.colorId, images: color.images, position: index },
        update: { images: color.images, position: index },
      });
    }

    const colorRows = await tx.productColor.findMany({ where: { productId } });
    const colorRowId = new Map(colorRows.map((c) => [c.colorId, c.id]));

    /* --- variants ------------------------------------------------------ */
    const keptVariantKeys = new Set(input.variants.map((v) => `${v.colorId}:${v.size}`));
    const sizeValueById = new Map(
      (await tx.size.findMany({ where: { id: { in: existing.variants.map((v) => v.sizeId) } } }))
        .map((s) => [s.id, s.value])
    );

    for (const stale of existing.variants) {
      const key = `${stale.colorId}:${sizeValueById.get(stale.sizeId)}`;
      if (keptVariantKeys.has(key)) continue;

      // A variant that appears in order history is deactivated, never deleted:
      // the order item must keep resolving for the customer's invoice.
      const inOrders = await tx.orderItem.count({ where: { variantId: stale.id } });
      if (inOrders > 0) {
        await tx.productVariant.update({
          where: { id: stale.id },
          data: { active: false, stock: 0 },
        });
      } else {
        await tx.productVariant.delete({ where: { id: stale.id } });
      }
    }

    for (const variant of input.variants) {
      const sizeId = sizeIds.get(variant.size)!;
      await tx.productVariant.upsert({
        where: {
          productId_colorId_sizeId: { productId, colorId: variant.colorId, sizeId },
        },
        create: {
          productId,
          productColorId: colorRowId.get(variant.colorId)!,
          colorId: variant.colorId,
          sizeId,
          sku: skuFor(input.slug, variant.colorId, variant.size, variant.sku),
          stock: variant.stock,
          price: variant.price ?? null,
          compareAtPrice: variant.compareAtPrice ?? null,
          active: variant.active ?? true,
        },
        update: {
          productColorId: colorRowId.get(variant.colorId)!,
          stock: variant.stock,
          price: variant.price ?? null,
          compareAtPrice: variant.compareAtPrice ?? null,
          active: variant.active ?? true,
          ...(variant.sku?.trim() ? { sku: variant.sku.trim().toUpperCase() } : {}),
        },
      });
    }

    await refreshSearchText(tx, productId);
    return { id: productId, slug: input.slug };
  });
}

/**
 * Archives a product.
 *
 * Deliberately not a delete: order items reference the product, and a customer
 * looking at a two-year-old order should still see what they bought. Archiving
 * takes it off the storefront and out of search, which is what "delete" means
 * to the person clicking it.
 */
export async function archiveProduct(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound("محصول پیدا نشد.");
  await prisma.product.update({ where: { id: productId }, data: { active: false } });
}

export async function setProductActive(productId: string, active: boolean): Promise<void> {
  await prisma.product.update({ where: { id: productId }, data: { active } });
}

/** Adjusts one variant's stock — the inventory screen's inline edit. */
export async function setVariantStock(variantId: string, stock: number): Promise<void> {
  if (stock < 0) throw badRequest("موجودی نمی‌تواند منفی باشد.");
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw notFound("تنوع محصول پیدا نشد.");
  await prisma.productVariant.update({ where: { id: variantId }, data: { stock } });
}

/* -------------------------------------------------------------------------- */
/* Admin listing                                                               */
/* -------------------------------------------------------------------------- */

export interface AdminProductFilters extends Pagination {
  q?: string;
  categoryId?: string;
  brandId?: string;
  gender?: Gender;
  status?: "active" | "inactive";
  stock?: "in" | "low" | "out";
  sort?: "newest" | "name" | "price-asc" | "price-desc" | "stock-asc";
}

export async function listAdminProducts(filters: AdminProductFilters) {
  const where: Prisma.ProductWhereInput = {};

  if (filters.status) where.active = filters.status === "active";
  if (filters.gender) where.gender = filters.gender;
  if (filters.brandId) where.brandId = filters.brandId;
  if (filters.categoryId) where.categories = { some: { categoryId: filters.categoryId } };

  const q = filters.q?.trim();
  if (q) {
    const normalized = normalizePersian(q);
    where.OR = [
      { searchText: { contains: normalized } },
      { slug: { contains: q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
    ];
  }

  if (filters.stock === "out") where.variants = { every: { stock: 0 } };
  if (filters.stock === "low") where.variants = { some: { stock: { gt: 0, lte: 3 } } };
  if (filters.stock === "in") where.variants = { some: { stock: { gt: 3 } } };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    filters.sort === "name"
      ? { name: "asc" }
      : filters.sort === "price-asc"
        ? { price: "asc" }
        : filters.sort === "price-desc"
          ? { price: "desc" }
          : { createdAt: "desc" };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      include: {
        brand: { select: { name: true } },
        categories: { include: { category: { select: { name: true } } } },
        colors: { select: { images: true }, orderBy: { position: "asc" }, take: 1 },
        variants: { select: { stock: true, active: true } },
      },
      ...paginationArgs(filters),
    }),
  ]);

  const items = rows.map((row) => {
    const totalStock = row.variants.reduce((n, v) => n + (v.active ? v.stock : 0), 0);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      image: row.colors[0]?.images[0] ?? "",
      brandName: row.brand.name,
      categoryNames: row.categories.map((c) => c.category.name),
      gender: row.gender,
      price: row.price,
      compareAtPrice: row.compareAtPrice,
      active: row.active,
      variantCount: row.variants.length,
      totalStock,
      outOfStock: totalStock === 0,
      soldCount: row.soldCount,
      createdAt: row.createdAt.toISOString(),
    };
  });

  // "Lowest stock first" is a computed total, so it is ordered after the query
  // rather than pretending a column exists for it.
  if (filters.sort === "stock-asc") items.sort((a, b) => a.totalStock - b.totalStock);

  return paginated(items, total, filters);
}

export type AdminProductListItem = Awaited<ReturnType<typeof listAdminProducts>>["items"][number];
