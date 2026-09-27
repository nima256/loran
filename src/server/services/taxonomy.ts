import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { conflict, notFound } from "../lib/errors";
import { slugify } from "@/lib/persian";

/**
 * Categories, colours and sizes.
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
  description?: string;
  image?: string;
  featured?: boolean;
  active?: boolean;
  position?: number;
}

export async function createCategory(input: CategoryInput) {
  const slug = input.slug?.trim() || slugify(input.name);
  const clash = await prisma.category.findUnique({ where: { slug } });
  if (clash) throw conflict("دسته‌بندی با این نشانی از قبل وجود دارد.");

  const last = await prisma.category.findFirst({ orderBy: { position: "desc" } });

  return prisma.category.create({
    data: {
      slug,
      name: input.name,
      description: input.description ?? null,
      image: input.image ?? null,
      featured: input.featured ?? false,
      active: input.active ?? true,
      position: input.position ?? (last ? last.position + 1 : 0),
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

  return prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.image !== undefined ? { image: input.image || null } : {}),
      ...(input.featured !== undefined ? { featured: input.featured } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
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
    include: { _count: { select: { products: true } } },
  });
  if (!category) throw notFound("دسته‌بندی پیدا نشد.");

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

export async function reorderCategories(order: { id: string; position: number }[]) {
  await prisma.$transaction(
    order.map((item) =>
      prisma.category.update({ where: { id: item.id }, data: { position: item.position } })
    )
  );
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
/* Brands                                                                      */
/* -------------------------------------------------------------------------- */

export async function listBrandsForAdmin() {
  const rows = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    active: row.active,
    productCount: row._count.products,
  }));
}

/** Everything the product editor needs to populate its pickers, in one call. */
export async function getProductEditorOptions() {
  const [categories, colors, sizes, brands] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    listColors(),
    listSizes(),
    prisma.brand.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
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
