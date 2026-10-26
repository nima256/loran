import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { slugify } from "@/lib/persian";
import { refreshSearchText } from "./admin-products";
import { MAX_CATEGORY_DEPTH, categoryAncestors, descendantIds, subtreeHeight } from "@/lib/category-tree";

/**
 * Categories, collections, colours and sizes.
 *
 * Deletion policy, applied consistently to all three:
 *
 *   in use by a PRODUCT  → refuse, and offer deactivation instead
 *   in use by an ORDER   → refuse outright; history must stay readable
 *   unused               → delete
 *
 * Deactivating removes something from the storefront and from the pickers
 * without breaking a single existing reference, which is what an administrator
 * almost always actually wants when they reach for "delete".
 */

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

export interface CategoryInput {
  name: string;
  slug?: string;
  /** `null` or "" clears the stored value; `undefined` leaves it alone. */
  description?: string | null;
  image?: string | null;
  featured?: boolean;
  active?: boolean;
  position?: number;
  /** Parent category; `null` makes it top-level. */
  parentId?: string | null;
}

/**
 * Checks a proposed parent: it must exist, must not be the category itself or
 * one of its descendants (that would make a cycle), and the move must keep the
 * whole subtree within `MAX_CATEGORY_DEPTH` levels.
 */
async function assertValidParent(parentId: string, movingId?: string) {
  const rows = await prisma.category.findMany({ select: { id: true, parentId: true } });
  if (!rows.some((r) => r.id === parentId)) throw badRequest("دسته‌بندی والد پیدا نشد.");
  if (movingId && descendantIds(rows, movingId).includes(parentId)) {
    throw badRequest("یک دسته‌بندی را نمی‌توان زیرمجموعه خودش یا زیردسته‌های خودش کرد.");
  }
  const parentDepth = categoryAncestors(rows, parentId).length;
  const height = movingId ? subtreeHeight(rows, movingId) : 0;
  if (parentDepth + 1 + height >= MAX_CATEGORY_DEPTH) {
    throw badRequest(`دسته‌بندی‌ها حداکثر ${MAX_CATEGORY_DEPTH} سطح می‌توانند داشته باشند.`);
  }
}

async function nextSiblingPosition(parentId: string | null): Promise<number> {
  const last = await prisma.category.findFirst({
    where: { parentId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return last ? last.position + 1 : 0;
}

export async function createCategory(input: CategoryInput) {
  const slug = input.slug?.trim() || slugify(input.name);
  if (!slug) throw badRequest("نشانی (slug) دسته‌بندی را وارد کنید.");
  const clash = await prisma.category.findUnique({ where: { slug } });
  if (clash) throw conflict("دسته‌بندی با این نشانی از قبل وجود دارد.");

  const parentId = input.parentId || null;
  if (parentId) await assertValidParent(parentId);

  return prisma.category.create({
    data: {
      slug,
      name: input.name,
      description: input.description || null,
      image: input.image || null,
      featured: input.featured ?? false,
      active: input.active ?? true,
      parentId,
      position: input.position ?? (await nextSiblingPosition(parentId)),
    },
  });
}

export async function updateCategory(id: string, input: Partial<CategoryInput>) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw notFound("دسته‌بندی پیدا نشد.");

  if (input.slug && input.slug !== existing.slug) {
    const clash = await prisma.category.findUnique({ where: { slug: input.slug } });
    if (clash) throw conflict("دسته‌بندی با این نشانی از قبل وجود دارد.");
  }

  // Moving to another parent: validate, and append at the end of the new
  // siblings so the move never collides with an existing position.
  let move: { parentId: string | null; position: number } | null = null;
  if (input.parentId !== undefined && (input.parentId || null) !== existing.parentId) {
    const parentId = input.parentId || null;
    if (parentId) await assertValidParent(parentId, id);
    move = { parentId, position: await nextSiblingPosition(parentId) };
  }

  return prisma.category.update({
    where: { id },
    data: {
      ...(move ?? {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.image !== undefined ? { image: input.image || null } : {}),
      ...(input.featured !== undefined ? { featured: input.featured } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.position !== undefined && !move ? { position: input.position } : {}),
    },
  });
}

export interface DeleteOutcome {
  /** "deleted" when the row is gone, "deactivated" when it was in use. */
  action: "deleted" | "deactivated";
  message: string;
}

/**
 * Removes a category, or deactivates it when products still point at it.
 *
 * Hard-deleting a category with products would leave those products
 * uncategorised and break the storefront navigation that links to it, so it is
 * refused in favour of an archive that keeps every reference intact.
 */
export async function deleteCategory(id: string): Promise<DeleteOutcome> {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!category) throw notFound("دسته‌بندی پیدا نشد.");

  // Subcategories are never deleted or orphaned implicitly: the administrator
  // decides where they go first.
  if (category._count.children > 0) {
    throw conflict(
      `«${category.name}» ${category._count.children} زیردسته دارد. ابتدا زیردسته‌ها را به دسته‌بندی دیگری منتقل یا حذف کنید.`
    );
  }

  if (category._count.products > 0) {
    if (!category.active) {
      throw conflict(
        `این دسته‌بندی ${category._count.products} محصول دارد. ابتدا محصول‌ها را به دسته‌بندی دیگری منتقل کنید.`
      );
    }
    await prisma.category.update({ where: { id }, data: { active: false } });
    return {
      action: "deactivated",
      message: `«${category.name}» ${category._count.products} محصول دارد، بنابراین به‌جای حذف، غیرفعال شد و از فروشگاه برداشته شد.`,
    };
  }

  await prisma.category.delete({ where: { id } });
  return { action: "deleted", message: `دسته‌بندی «${category.name}» حذف شد.` };
}

/**
 * Applies a new display order to one set of siblings (the children of one
 * parent, or the top level). The list must name every sibling exactly once,
 * so a stale screen cannot silently drop a row out of the ordering.
 */
export async function reorderCategories(ids: string[]): Promise<void> {
  const first = await prisma.category.findUnique({ where: { id: ids[0] }, select: { parentId: true } });
  if (!first) throw conflict("فهرست تغییر کرده است. صفحه را تازه کنید و دوباره مرتب کنید.");
  const rows = await prisma.category.findMany({ where: { parentId: first.parentId }, select: { id: true } });
  assertCompleteOrder(ids, rows.map((r) => r.id));
  await prisma.$transaction(
    ids.map((id, position) => prisma.category.update({ where: { id }, data: { position } }))
  );
}

function assertCompleteOrder(ids: string[], existing: string[]) {
  const known = new Set(existing);
  if (new Set(ids).size !== ids.length || ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw conflict("فهرست تغییر کرده است. صفحه را تازه کنید و دوباره مرتب کنید.");
  }
}

/* -------------------------------------------------------------------------- */
/* Colours                                                                     */
/* -------------------------------------------------------------------------- */

export interface ColorInput {
  name: string;
  hex: string;
  hexSecondary?: string | null;
  slug?: string;
  active?: boolean;
}

export async function listColors(options: { includeInactive?: boolean } = {}) {
  const rows = await prisma.color.findMany({
    where: options.includeInactive ? {} : { active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { productColors: true, variants: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    hex: row.hex,
    hexSecondary: row.hexSecondary ?? undefined,
    active: row.active,
    productCount: row._count.productColors,
    variantCount: row._count.variants,
  }));
}

export async function createColor(input: ColorInput) {
  const slug = input.slug?.trim() || slugify(input.name);
  const clash = await prisma.color.findUnique({ where: { slug } });
  if (clash) throw conflict("رنگی با این نام از قبل ثبت شده است.");

  const last = await prisma.color.findFirst({ orderBy: { position: "desc" } });
  return prisma.color.create({
    data: {
      slug,
      name: input.name,
      hex: input.hex,
      hexSecondary: input.hexSecondary ?? null,
      active: input.active ?? true,
      position: last ? last.position + 1 : 0,
    },
  });
}

export async function updateColor(id: string, input: Partial<ColorInput>) {
  const existing = await prisma.color.findUnique({ where: { id } });
  if (!existing) throw notFound("رنگ پیدا نشد.");
  return prisma.color.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.hex !== undefined ? { hex: input.hex } : {}),
      ...(input.hexSecondary !== undefined ? { hexSecondary: input.hexSecondary || null } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
}

/**
 * Removes a colour, or deactivates it when it is in use.
 *
 * A colour that appears in an order item is never deleted — the order snapshot
 * carries the colour *name*, but the variant link would break and the admin's
 * own order detail screen resolves through it.
 */
export async function deleteColor(id: string): Promise<DeleteOutcome> {
  const color = await prisma.color.findUnique({
    where: { id },
    include: { _count: { select: { productColors: true, variants: true } } },
  });
  if (!color) throw notFound("رنگ پیدا نشد.");

  const inOrders = await prisma.orderItem.count({ where: { variant: { colorId: id } } });
  if (inOrders > 0 || color._count.productColors > 0) {
    if (!color.active) {
      throw conflict("این رنگ در محصولات یا سفارش‌ها استفاده شده و قابل حذف نیست.");
    }
    await prisma.color.update({ where: { id }, data: { active: false } });
    return {
      action: "deactivated",
      message: `رنگ «${color.name}» در محصولات یا سفارش‌ها استفاده شده، بنابراین غیرفعال شد و دیگر برای محصول‌های تازه در دسترس نیست.`,
    };
  }

  await prisma.color.delete({ where: { id } });
  return { action: "deleted", message: `رنگ «${color.name}» حذف شد.` };
}

/* -------------------------------------------------------------------------- */
/* Sizes                                                                       */
/* -------------------------------------------------------------------------- */

export async function listSizes(options: { includeInactive?: boolean } = {}) {
  const rows = await prisma.size.findMany({
    where: options.includeInactive ? {} : { active: true },
    orderBy: { value: "asc" },
    include: { _count: { select: { variants: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    value: row.value,
    label: row.label,
    active: row.active,
    variantCount: row._count.variants,
  }));
}

export async function createSize(value: number, label?: string) {
  const clash = await prisma.size.findUnique({ where: { value } });
  if (clash) throw conflict("این سایز از قبل ثبت شده است.");
  return prisma.size.create({
    data: { value, label: label?.trim() || String(value), position: value },
  });
}

export async function updateSize(id: string, input: { label?: string; active?: boolean }) {
  const existing = await prisma.size.findUnique({ where: { id } });
  if (!existing) throw notFound("سایز پیدا نشد.");
  return prisma.size.update({
    where: { id },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
}

export async function deleteSize(id: string): Promise<DeleteOutcome> {
  const size = await prisma.size.findUnique({
    where: { id },
    include: { _count: { select: { variants: true } } },
  });
  if (!size) throw notFound("سایز پیدا نشد.");

  if (size._count.variants > 0) {
    if (!size.active) {
      throw conflict("این سایز در محصولات استفاده شده و قابل حذف نیست.");
    }
    await prisma.size.update({ where: { id }, data: { active: false } });
    return {
      action: "deactivated",
      message: `سایز ${size.label} در محصولات استفاده شده، بنابراین غیرفعال شد.`,
    };
  }

  await prisma.size.delete({ where: { id } });
  return { action: "deleted", message: `سایز ${size.label} حذف شد.` };
}

/* -------------------------------------------------------------------------- */
/* Collections                                                                 */
/* -------------------------------------------------------------------------- */

/*
 * A collection («کالکشن») is the `Brand` row every product already belongs to —
 * the product editor and the shop filter have always called it that. A
 * product has exactly one collection, so "assigning" a product to a
 * collection moves it there from wherever it was.
 */

export interface CollectionInput {
  name: string;
  slug?: string;
  /** Subtitle. `null` or "" clears it. */
  description?: string | null;
  image?: string | null;
  active?: boolean;
  position?: number;
}

export interface AdminCollectionRow {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image?: string;
  active: boolean;
  position: number;
  productCount: number;
}

export async function listCollectionsForAdmin(): Promise<AdminCollectionRow[]> {
  const rows = await prisma.brand.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    image: row.image ?? undefined,
    active: row.active,
    position: row.position,
    productCount: row._count.products,
  }));
}

/** Kept for callers that predate collections; same rows, same order. */
export const listBrandsForAdmin = listCollectionsForAdmin;

export async function createCollection(input: CollectionInput) {
  const slug = input.slug?.trim() || slugify(input.name);
  if (!slug) throw badRequest("نشانی (slug) کالکشن را وارد کنید.");
  const clash = await prisma.brand.findUnique({ where: { slug } });
  if (clash) throw conflict("کالکشنی با این نشانی از قبل وجود دارد.");

  const last = await prisma.brand.findFirst({ orderBy: { position: "desc" } });
  return prisma.brand.create({
    data: {
      slug,
      name: input.name,
      description: input.description || null,
      image: input.image || null,
      active: input.active ?? true,
      position: input.position ?? (last ? last.position + 1 : 0),
    },
  });
}

export async function updateCollection(id: string, input: Partial<CollectionInput>) {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw notFound("کالکشن پیدا نشد.");

  if (input.slug && input.slug !== existing.slug) {
    const clash = await prisma.brand.findUnique({ where: { slug: input.slug } });
    if (clash) throw conflict("کالکشنی با این نشانی از قبل وجود دارد.");
  }

  return prisma.brand.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.image !== undefined ? { image: input.image || null } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
    },
  });
}

/**
 * Removes a collection, or hides it when products still belong to it.
 *
 * A product cannot exist without a collection, so deleting one that still has
 * products would either orphan them or delete them — neither is acceptable.
 * It is taken off the storefront instead; the products stay on sale.
 */
export async function deleteCollection(id: string): Promise<DeleteOutcome> {
  const collection = await prisma.brand.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!collection) throw notFound("کالکشن پیدا نشد.");

  const count = collection._count.products;
  if (count > 0) {
    if (!collection.active) {
      throw conflict(
        `این کالکشن ${count} محصول دارد. ابتدا محصول‌ها را به کالکشن دیگری منتقل کنید، سپس آن را حذف کنید.`
      );
    }
    await prisma.brand.update({ where: { id }, data: { active: false } });
    return {
      action: "deactivated",
      message: `«${collection.name}» ${count} محصول دارد، بنابراین به‌جای حذف، غیرفعال شد و از صفحه اصلی برداشته شد. محصول‌های آن همچنان در فروشگاه هستند.`,
    };
  }

  await prisma.brand.delete({ where: { id } });
  return { action: "deleted", message: `کالکشن «${collection.name}» حذف شد.` };
}

export async function reorderCollections(ids: string[]): Promise<void> {
  const rows = await prisma.brand.findMany({ select: { id: true } });
  assertCompleteOrder(ids, rows.map((r) => r.id));
  await prisma.$transaction(
    ids.map((id, position) => prisma.brand.update({ where: { id }, data: { position } }))
  );
}

/**
 * Moves products into a collection. Only the products named are touched, and
 * only their collection changes — nothing else about them is rewritten.
 */
export async function assignProductsToCollection(
  id: string,
  productIds: string[]
): Promise<{ moved: number }> {
  const collection = await prisma.brand.findUnique({ where: { id } });
  if (!collection) throw notFound("کالکشن پیدا نشد.");

  const unique = [...new Set(productIds)];
  const found = await prisma.product.count({ where: { id: { in: unique } } });
  if (found !== unique.length) throw notFound("یکی از محصولات انتخاب‌شده پیدا نشد.");

  const result = await prisma.product.updateMany({
    where: { id: { in: unique }, brandId: { not: id } },
    data: { brandId: id },
  });
  // The collection name is part of each product's search haystack.
  await refreshSearchTextFor(unique);
  return { moved: result.count };
}

/** A collection's products, for the admin assignment screen. */
export async function listCollectionProducts(id: string) {
  const rows = await prisma.product.findMany({
    where: { brandId: id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      active: true,
      colors: { select: { images: true }, orderBy: { position: "asc" }, take: 1 },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    active: row.active,
    image: row.colors[0]?.images[0] ?? "",
  }));
}

async function refreshSearchTextFor(productIds: string[]) {
  for (const productId of productIds) await refreshSearchText(prisma, productId);
}

/** Everything the product editor needs to populate its pickers, in one call. */
export async function getProductEditorOptions() {
  const [categories, colors, sizes, brands] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    }),
    listColors(),
    listSizes(),
    prisma.brand.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
  ]);
  return { categories, colors, sizes, brands };
}

export type ProductEditorOptions = Awaited<ReturnType<typeof getProductEditorOptions>>;

/** Narrowing helper for Prisma unique-violation handling at call sites. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
