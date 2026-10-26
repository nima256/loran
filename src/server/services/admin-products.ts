import "server-only";
import { Prisma, type Gender } from "@prisma/client";
import { prisma, type Db } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { paginated, paginationArgs, type Pagination } from "../lib/validation";
import { normalizePersian } from "@/lib/persian";
import { randomToken } from "../lib/crypto";
import { deleteUnreferencedMedia } from "./media";

/**
 * Product authoring.
 *
 * The editor writes a whole product in one go — identity, categories,
 * colourways with their galleries, and the variant matrix — so everything lands
 * in a single transaction and a half-written product is never visible.
 *
 * Invariants enforced here rather than trusted from the form:
 *  - no duplicate (product, colour, size) variant, which is also a database
 *    unique constraint;
 *  - a variant is never hard-deleted while order history points at it;
 *  - a colourway is identified by its own row id, not by its colour, so
 *    changing a colourway's colour (Black → Burgundy) renames that row and
 *    keeps its gallery, its variants, their stock, prices and order links.
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

export async function refreshSearchText(db: Db, productId: string): Promise<void> {
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
  /** The existing colourway row, when editing. Absent for a new colourway. */
  id?: string;
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
  const rowIds = new Set<string>();
  for (const color of input.colors) {
    if (colorIds.has(color.colorId)) {
      throw badRequest("هر رنگ فقط یک بار می‌تواند به محصول اضافه شود.");
    }
    colorIds.add(color.colorId);
    if (color.id) {
      if (rowIds.has(color.id)) throw badRequest("یک رنگ محصول دو بار ارسال شده است.");
      rowIds.add(color.id);
    }
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

/**
 * Makes a SKU unique by suffixing it. A renamed colourway keeps its variants'
 * SKUs, so re-adding the original colour later would otherwise generate the
 * very SKU that is already taken.
 */
async function uniqueSku(db: Db, sku: string): Promise<string> {
  let candidate = sku;
  for (let n = 2; await db.productVariant.findUnique({ where: { sku: candidate }, select: { id: true } }); n++) {
    candidate = `${sku}-${n}`;
  }
  return candidate;
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
          sku: await uniqueSku(tx, skuFor(input.slug, variant.colorId, variant.size, variant.sku)),
          stock: variant.stock,
          price: variant.price ?? null,
          compareAtPrice: variant.compareAtPrice ?? null,
          active: variant.active ?? true,
        },
      });
    }

    await refreshSearchText(tx, product.id);
    return { id: product.id, slug: product.slug };
  }, TX_OPTIONS);
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

  const result = await prisma.$transaction(async (tx) => {
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
    // Match each submitted colourway to its existing row: by row id first,
    // then — for callers that send no ids — by colour among the rows nobody
    // claimed. Whatever is left unmatched was removed in the editor.
    const rowsById = new Map(existing.colors.map((row) => [row.id, row]));
    const claimed = new Set<string>();
    const matched = new Map<ProductColorInput, (typeof existing.colors)[number]>();
    for (const color of input.colors) {
      if (!color.id) continue;
      const row = rowsById.get(color.id);
      if (!row) throw badRequest("یکی از رنگ‌های ارسال‌شده متعلق به این محصول نیست. صفحه را تازه کنید.");
      matched.set(color, row);
      claimed.add(row.id);
    }
    for (const color of input.colors) {
      if (color.id) continue;
      const row = existing.colors.find((r) => !claimed.has(r.id) && r.colorId === color.colorId);
      if (!row) continue;
      matched.set(color, row);
      claimed.add(row.id);
    }

    for (const stale of existing.colors) {
      if (claimed.has(stale.id)) continue;
      // Removing a colourway would orphan its variants, and those variants may
      // be referenced by past orders — so it is refused rather than cascading.
      const inOrders = await tx.orderItem.count({ where: { variant: { productColorId: stale.id } } });
      if (inOrders > 0) {
        throw conflict(
          "این رنگ در سفارش‌های ثبت‌شده استفاده شده و قابل حذف نیست. می‌توانید تنوع‌های آن را غیرفعال کنید."
        );
      }
      await tx.productVariant.deleteMany({ where: { productColorId: stale.id } });
      await tx.productColor.delete({ where: { id: stale.id } });
    }

    await applyColorChanges(
      tx,
      [...matched.entries()]
        .filter(([color, row]) => color.colorId !== row.colorId)
        .map(([color, row]) => ({ rowId: row.id, from: row.colorId, to: color.colorId }))
    );

    for (const [index, color] of input.colors.entries()) {
      const row = matched.get(color);
      if (row) {
        await tx.productColor.update({
          where: { id: row.id },
          data: { images: color.images, position: index },
        });
      } else {
        await tx.productColor.create({
          data: { productId, colorId: color.colorId, images: color.images, position: index },
        });
      }
    }

    const colorRows = await tx.productColor.findMany({ where: { productId } });
    const colorRowId = new Map(colorRows.map((c) => [c.colorId, c.id]));

    /* --- variants ------------------------------------------------------ */
    // Read after the colour changes, so a renamed colourway's variants are
    // matched under their new colour — and updated in place, not recreated.
    const current = await tx.productVariant.findMany({
      where: { productId },
      include: { size: { select: { value: true } } },
    });
    const currentByKey = new Map(current.map((v) => [`${v.colorId}:${v.size.value}`, v]));
    const keptVariantKeys = new Set(input.variants.map((v) => `${v.colorId}:${v.size}`));

    for (const stale of current) {
      if (keptVariantKeys.has(`${stale.colorId}:${stale.size.value}`)) continue;

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
      const found = currentByKey.get(`${variant.colorId}:${variant.size}`);
      if (found) {
        await tx.productVariant.update({
          where: { id: found.id },
          data: {
            productColorId: colorRowId.get(variant.colorId)!,
            stock: variant.stock,
            price: variant.price ?? null,
            compareAtPrice: variant.compareAtPrice ?? null,
            active: variant.active ?? true,
            ...(variant.sku?.trim() && variant.sku.trim().toUpperCase() !== found.sku
              ? { sku: await uniqueSku(tx, variant.sku.trim().toUpperCase()) }
              : {}),
          },
        });
      } else {
        await tx.productVariant.create({
          data: {
            productId,
            productColorId: colorRowId.get(variant.colorId)!,
            colorId: variant.colorId,
            sizeId,
            sku: await uniqueSku(tx, skuFor(input.slug, variant.colorId, variant.size, variant.sku)),
            stock: variant.stock,
            price: variant.price ?? null,
            compareAtPrice: variant.compareAtPrice ?? null,
            active: variant.active ?? true,
          },
        });
      }
    }

    await refreshSearchText(tx, productId);
    return { id: productId, slug: input.slug };
  }, TX_OPTIONS);

  // Images the editor dropped are removed from disk only once the save has
  // committed, and only if nothing else — another colour, another product, a
  // category, a collection or an order — still points at them.
  const kept = new Set(input.colors.flatMap((c) => c.images));
  await deleteUnreferencedMedia(existing.colors.flatMap((c) => c.images).filter((url) => !kept.has(url)));

  return result;
}

/** A full product save touches every variant; give it room on a slow server. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

/**
 * Changes the colour of existing colourway rows, carrying their variants along.
 *
 * Done row by row so the (product, colour) and (product, colour, size) unique
 * keys hold at every step. A row is moved only once its target colour is free;
 * when every remaining move waits on another (Black ↔ Burgundy swapped in one
 * save), one row is parked on a throwaway colour to break the cycle.
 */
async function applyColorChanges(
  tx: Prisma.TransactionClient,
  changes: { rowId: string; from: string; to: string }[]
): Promise<void> {
  if (!changes.length) return;

  const holderOf = new Map<string, string>(changes.map((c) => [c.from, c.rowId]));
  const pending = [...changes];
  let parking: string | null = null;

  const move = async (rowId: string, from: string, to: string) => {
    await tx.productColor.update({ where: { id: rowId }, data: { colorId: to } });
    await tx.productVariant.updateMany({ where: { productColorId: rowId }, data: { colorId: to } });
    holderOf.delete(from);
    holderOf.set(to, rowId);
  };

  for (let guard = 0; pending.length && guard < changes.length * 3; guard++) {
    const ready = pending.findIndex((c) => !holderOf.has(c.to));
    if (ready >= 0) {
      const [change] = pending.splice(ready, 1);
      await move(change.rowId, change.from, change.to);
      continue;
    }
    if (!parking) {
      const temp = await tx.color.create({
        data: { slug: `tmp-${randomToken(8)}`, name: "temp", hex: "#000000", active: false },
      });
      parking = temp.id;
    }
    const [head] = pending;
    await move(head.rowId, head.from, parking);
    head.from = parking;
  }
  if (pending.length) throw conflict("تغییر رنگ‌ها انجام نشد. صفحه را تازه کنید و دوباره تلاش کنید.");
  if (parking) await tx.color.delete({ where: { id: parking } });
}

/**
 * Archives a product: off the storefront and out of search, every row kept.
 * The reversible alternative to `deleteProduct`.
 */
export async function archiveProduct(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound("محصول پیدا نشد.");
  await prisma.product.update({ where: { id: productId }, data: { active: false } });
}

export interface DeletedProduct {
  id: string;
  name: string;
  slug: string;
  /** Order lines that referenced the product and now stand on their snapshot. */
  orderItems: number;
  /** Uploaded files that were removed because nothing referenced them any more. */
  deletedImages: number;
}

/**
 * Permanently deletes a product.
 *
 * Its colourways, variants, category links, campaign entries and reviews go
 * with it (cascade). Past orders are *not* touched beyond losing the link:
 * every order line carries a snapshot of the name, image, colour, size and
 * price, and its product/variant references are nulled by the database
 * (`ON DELETE SET NULL`), so invoices and order history keep rendering.
 *
 * The gallery files are removed afterwards, and only those no other record
 * still uses — an order's snapshot image included.
 */
export async function deleteProduct(productId: string): Promise<DeletedProduct> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { colors: { select: { images: true } }, _count: { select: { orderItems: true } } },
  });
  if (!product) throw notFound("محصول پیدا نشد.");

  await prisma.product.delete({ where: { id: productId } });
  const deleted = await deleteUnreferencedMedia(product.colors.flatMap((c) => c.images));

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    orderItems: product._count.orderItems,
    deletedImages: deleted.length,
  };
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
