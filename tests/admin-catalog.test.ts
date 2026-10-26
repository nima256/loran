import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/server/lib/prisma";
import { env } from "@/server/lib/env";
import {
  getBestSellers, getNewArrivals, getOnSale, getProduct, listBrands, listCategories, searchProducts,
} from "@/server/services/catalog";
import { createProduct, deleteProduct, updateProduct, type ProductInput } from "@/server/services/admin-products";
import {
  assignProductsToCollection, createCategory, createCollection, deleteCategory, deleteCollection,
  reorderCategories, reorderCollections, updateCategory, updateCollection,
} from "@/server/services/taxonomy";
import { deleteUnreferencedMedia } from "@/server/services/media";
import { resolveShipping } from "@/server/services/shipping";
import { createManualOrder } from "@/server/services/manual-orders";
import { productSchema, categorySchema } from "@/server/schemas/admin";
import { parseFilters } from "@/lib/shop-params";
import { siteConfig } from "@/lib/site-config";

/**
 * The admin catalogue workflows: colour editing that keeps images and stock,
 * product deletion, badge-driven homepage sections, category and collection
 * management, the retired genders and the free-shipping threshold.
 */

const stamp = Date.now();
const createdProducts: string[] = [];
let black: { id: string };
let burgundy: { id: string };
let tan: { id: string };
let base: Pick<ProductInput, "brandId" | "categoryIds">;

beforeAll(async () => {
  const [category] = await listCategories();
  const [brand] = await listBrands();
  base = { brandId: brand.id, categoryIds: [category.id] };
  black = await prisma.color.create({ data: { slug: `t-black-${stamp}`, name: "مشکی آزمون", hex: "#111111" } });
  burgundy = await prisma.color.create({ data: { slug: `t-burg-${stamp}`, name: "زرشکی آزمون", hex: "#7C1418" } });
  tan = await prisma.color.create({ data: { slug: `t-tan-${stamp}`, name: "عسلی آزمون", hex: "#9C6B3E" } });
});

afterAll(async () => {
  await prisma.product.deleteMany({ where: { id: { in: createdProducts } } });
  await prisma.color.deleteMany({ where: { id: { in: [black.id, burgundy.id, tan.id] } } });
  await prisma.$disconnect();
});

function input(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: "محصول آزمون رنگ",
    slug: `t-color-${stamp}-${Math.random().toString(36).slice(2, 8)}`,
    ...base,
    gender: "women",
    price: 2_000_000,
    compareAtPrice: null,
    description: "",
    features: [],
    specs: [],
    tags: [],
    active: true,
    colors: [],
    variants: [],
    ...overrides,
  };
}

async function make(overrides: Partial<ProductInput>) {
  const data = input(overrides);
  const created = await createProduct(data);
  createdProducts.push(created.id);
  return { created, data };
}

async function load(id: string) {
  return prisma.product.findUniqueOrThrow({
    where: { id },
    include: { colors: { orderBy: { position: "asc" } }, variants: { include: { size: true } } },
  });
}

describe("editing a colour keeps its images, stock and prices", () => {
  it("renames Black → Burgundy in place", async () => {
    const images = ["/products/boot-black-side.svg", "/products/boot-black-angle.svg"];
    const { created, data } = await make({
      colors: [{ colorId: black.id, images }],
      variants: [
        { colorId: black.id, size: 40, stock: 4, price: 2_100_000 },
        { colorId: black.id, size: 41, stock: 7 },
      ],
    });
    const before = await load(created.id);
    const row = before.colors[0];
    const variantIds = before.variants.map((v) => v.id).sort();

    await updateProduct(created.id, {
      ...data,
      colors: [{ id: row.id, colorId: burgundy.id, images }],
      variants: before.variants.map((v) => ({
        id: v.id, colorId: burgundy.id, size: v.size.value, sku: v.sku, stock: v.stock, price: v.price,
      })),
    });

    const after = await load(created.id);
    expect(after.colors).toHaveLength(1);
    // Same row, new colour, same gallery in the same order.
    expect(after.colors[0].id).toBe(row.id);
    expect(after.colors[0].colorId).toBe(burgundy.id);
    expect(after.colors[0].images).toEqual(images);
    // Same variant rows — so order history and SKUs survive — with stock and price intact.
    expect(after.variants.map((v) => v.id).sort()).toEqual(variantIds);
    expect(after.variants.every((v) => v.colorId === burgundy.id && v.productColorId === row.id)).toBe(true);
    const v40 = after.variants.find((v) => v.size.value === 40)!;
    expect(v40.stock).toBe(4);
    expect(v40.price).toBe(2_100_000);

    // The public product page shows the images under Burgundy, and no Black.
    const storefront = await getProduct(data.slug);
    expect(storefront?.colors.map((c) => c.id)).toEqual([burgundy.id]);
    expect(storefront?.colors[0].images).toEqual(images);
  });

  it("swaps two colours in a single save without a unique-key collision", async () => {
    const { created, data } = await make({
      colors: [
        { colorId: black.id, images: ["/products/boot-black-side.svg"] },
        { colorId: burgundy.id, images: ["/products/boot-burgundy-side.svg"] },
      ],
      variants: [
        { colorId: black.id, size: 40, stock: 1 },
        { colorId: burgundy.id, size: 40, stock: 9 },
      ],
    });
    const before = await load(created.id);
    const [blackRow, burgRow] = before.colors;

    await updateProduct(created.id, {
      ...data,
      colors: [
        { id: blackRow.id, colorId: burgundy.id, images: blackRow.images },
        { id: burgRow.id, colorId: black.id, images: burgRow.images },
      ],
      variants: [
        { colorId: burgundy.id, size: 40, stock: 1 },
        { colorId: black.id, size: 40, stock: 9 },
      ],
    });

    const after = await load(created.id);
    const byRow = new Map(after.colors.map((c) => [c.id, c]));
    expect(byRow.get(blackRow.id)?.colorId).toBe(burgundy.id);
    expect(byRow.get(burgRow.id)?.colorId).toBe(black.id);
    expect(after.variants.find((v) => v.colorId === burgundy.id)?.stock).toBe(1);
    expect(after.variants.find((v) => v.colorId === black.id)?.stock).toBe(9);
    // The temporary colour used to break the cycle is gone.
    expect(await prisma.color.count({ where: { slug: { startsWith: "tmp-" } } })).toBe(0);
  });

  it("moves selected images to another colour and leaves the rest untouched", async () => {
    const blackImages = ["/products/sneaker-black-side.svg", "/products/sneaker-black-angle.svg", "/products/sneaker-black-pair.svg"];
    const { created, data } = await make({
      colors: [
        { colorId: black.id, images: blackImages },
        { colorId: burgundy.id, images: ["/products/sneaker-burgundy-side.svg"] },
      ],
      variants: [{ colorId: black.id, size: 42, stock: 3 }, { colorId: burgundy.id, size: 42, stock: 2 }],
    });
    const before = await load(created.id);
    const moved = blackImages.slice(1);

    await updateProduct(created.id, {
      ...data,
      colors: [
        { id: before.colors[0].id, colorId: black.id, images: [blackImages[0]] },
        { id: before.colors[1].id, colorId: burgundy.id, images: ["/products/sneaker-burgundy-side.svg", ...moved] },
      ],
    });

    const after = await load(created.id);
    expect(after.colors[0].images).toEqual([blackImages[0]]);
    expect(after.colors[1].images).toEqual(["/products/sneaker-burgundy-side.svg", ...moved]);
    // Stock on both colours is unchanged.
    expect(after.variants.map((v) => v.stock).sort()).toEqual([2, 3]);
  });

  it("re-adding the original colour after a rename gets a unique SKU", async () => {
    const { created, data } = await make({
      colors: [{ colorId: black.id, images: [] }],
      variants: [{ colorId: black.id, size: 39, stock: 1 }],
    });
    const before = await load(created.id);
    await updateProduct(created.id, {
      ...data,
      colors: [
        { id: before.colors[0].id, colorId: burgundy.id, images: [] },
        { colorId: black.id, images: [] },
      ],
      variants: [
        { colorId: burgundy.id, size: 39, stock: 1, sku: before.variants[0].sku },
        { colorId: black.id, size: 39, stock: 2 },
      ],
    });
    const after = await load(created.id);
    expect(after.variants).toHaveLength(2);
    expect(new Set(after.variants.map((v) => v.sku)).size).toBe(2);
  });

  it("refuses a colourway id that belongs to another product", async () => {
    const one = await make({ colors: [{ colorId: black.id, images: [] }] });
    const two = await make({ colors: [{ colorId: tan.id, images: [] }] });
    const foreignRow = (await load(two.created.id)).colors[0].id;

    await expect(
      updateProduct(one.created.id, { ...one.data, colors: [{ id: foreignRow, colorId: black.id, images: [] }] })
    ).rejects.toThrow();
    // The other product is untouched.
    expect((await load(two.created.id)).colors[0].colorId).toBe(tan.id);
  });
});

describe("product deletion", () => {
  it("removes the product from every storefront read and keeps order history", async () => {
    const { created, data } = await make({
      name: "محصول آزمون حذف یکتا",
      tags: ["new", "bestseller", "sale"],
      colors: [{ colorId: tan.id, images: ["/products/loafer-tan-side.svg"] }],
      variants: [{ colorId: tan.id, size: 41, stock: 5 }],
    });
    const variant = (await load(created.id)).variants[0];
    const order = await createManualOrder({
      customer: { firstName: "آزمون", lastName: "حذف", phone: "09130000001" },
      items: [{ variantId: variant.id, quantity: 1 }],
      status: "preparing",
      paymentStatus: "paid",
      paymentMethod: "cash",
    });

    const result = await deleteProduct(created.id);
    expect(result.orderItems).toBe(1);

    expect(await prisma.product.findUnique({ where: { id: created.id } })).toBeNull();
    expect(await getProduct(data.slug)).toBeNull();
    expect((await searchProducts({ q: "آزمون حذف یکتا", page: 1 })).total).toBe(0);
    const sections = [...(await getNewArrivals(50)), ...(await getBestSellers(50)), ...(await getOnSale(50))];
    expect(sections.some((p) => p.id === created.id)).toBe(false);

    // The order line still renders from its snapshot; only the link is gone.
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.productId).toBeNull();
    expect(item.variantId).toBeNull();
    expect(item.name).toBe(data.name);
    expect(item.image).toBe("/products/loafer-tan-side.svg");

    await prisma.order.delete({ where: { id: order.id } });
  });
});

describe("uploaded image cleanup", () => {
  it("deletes an orphaned upload but keeps one still referenced anywhere", async () => {
    const dir = path.join(process.cwd(), env.UPLOAD_DIR, "products");
    await mkdir(dir, { recursive: true });
    const files = ["orphan", "kept"].map((name) => {
      const key = `products/test-${stamp}-${name}.webp`;
      return { key, url: `${env.UPLOAD_PUBLIC_PREFIX}/${key}`, file: path.join(process.cwd(), env.UPLOAD_DIR, key) };
    });
    for (const f of files) {
      await writeFile(f.file, "x");
      await prisma.mediaAsset.create({ data: { url: f.url, key: f.key, mimeType: "image/webp", bytes: 1 } });
    }
    const keeper = await make({ colors: [{ colorId: tan.id, images: [files[1].url] }] });

    const deleted = await deleteUnreferencedMedia(files.map((f) => f.url));
    expect(deleted).toEqual([files[0].url]);
    await expect(stat(files[0].file)).rejects.toThrow();
    expect((await stat(files[1].file)).isFile()).toBe(true);

    // Dropping the last reference in a save removes the file.
    await updateProduct(keeper.created.id, {
      ...keeper.data,
      colors: [{ id: (await load(keeper.created.id)).colors[0].id, colorId: tan.id, images: [] }],
    });
    await expect(stat(files[1].file)).rejects.toThrow();
    expect(await prisma.mediaAsset.count({ where: { url: { in: files.map((f) => f.url) } } })).toBe(0);
  });
});

describe("badge-driven homepage sections", () => {
  it("shows tagged products in their sections, updating when the badge changes", async () => {
    const { created, data } = await make({
      tags: ["new"],
      colors: [{ colorId: tan.id, images: ["/products/runner-tan-side.svg"] }],
      variants: [{ colorId: tan.id, size: 40, stock: 2 }],
    });
    expect((await getNewArrivals(200)).some((p) => p.id === created.id)).toBe(true);
    expect((await getBestSellers(200)).some((p) => p.id === created.id)).toBe(false);

    await updateProduct(created.id, {
      ...data,
      tags: ["bestseller", "sale"],
      colors: [{ id: (await load(created.id)).colors[0].id, ...data.colors[0] }],
    });
    expect((await getNewArrivals(200)).some((p) => p.id === created.id)).toBe(false);
    expect((await getBestSellers(200)).some((p) => p.id === created.id)).toBe(true);
    // Tagged «حراج» without a markdown: still listed, at its own (undiscounted) price.
    const sale = (await getOnSale(200)).find((p) => p.id === created.id);
    expect(sale?.price).toBe(data.price);
    // Badged products always come before merely-discounted ones.
    const first8 = await getOnSale(8);
    const firstUntagged = first8.findIndex((p) => !p.tags.includes("sale"));
    if (firstUntagged >= 0) expect(first8.slice(firstUntagged).every((p) => !p.tags.includes("sale"))).toBe(true);
    // Every section product is actually tagged.
    expect((await getBestSellers(8)).every((p) => p.tags.includes("bestseller"))).toBe(true);
  });

  it("the shop understands ?tag= for the sections' see-all links", async () => {
    expect(parseFilters({ tag: "new" }).tag).toBe("new");
    expect(parseFilters({ tag: "bogus" }).tag).toBeUndefined();
    const result = await searchProducts({ tag: "new", page: 1 });
    expect(result.items.every((p) => p.tags.includes("new"))).toBe(true);
  });
});

describe("retired genders", () => {
  it("the product schema rejects unisex and kids, accepts men and women", () => {
    const body = {
      name: "آزمون", slug: "t-g", brandId: "b", categoryIds: ["c"], price: 1000,
      colors: [{ colorId: "x", images: [] }],
    };
    expect(productSchema.safeParse({ ...body, gender: "unisex" }).success).toBe(false);
    expect(productSchema.safeParse({ ...body, gender: "kids" }).success).toBe(false);
    expect(productSchema.safeParse({ ...body, gender: "men" }).success).toBe(true);
    expect(productSchema.safeParse({ ...body, gender: "women" }).success).toBe(true);
  });

  it("the shop ignores a stale ?gender=kids link instead of returning nothing", () => {
    expect(parseFilters({ gender: "kids,women" }).genders).toEqual(["women"]);
  });
});

describe("categories", () => {
  it("a new category is listed for the storefront with its image and subtitle", async () => {
    const category = await createCategory({
      name: `دسته آزمون ${stamp}`,
      description: "زیرعنوان آزمون",
      image: "/products/boot-tan-side.svg",
      featured: true,
    });
    const listed = (await listCategories()).find((c) => c.id === category.id);
    expect(listed).toMatchObject({ description: "زیرعنوان آزمون", image: "/products/boot-tan-side.svg", featured: true });

    // Subtitle and image can be cleared.
    await updateCategory(category.id, { description: "", image: null });
    const cleared = (await listCategories()).find((c) => c.id === category.id);
    expect(cleared?.description).toBeUndefined();
    expect(cleared?.image).toBeUndefined();

    // Hidden categories leave the storefront but stay in the admin list.
    await updateCategory(category.id, { active: false });
    expect((await listCategories()).some((c) => c.id === category.id)).toBe(false);
    expect((await listCategories({ includeInactive: true })).find((c) => c.id === category.id)?.active).toBe(false);

    expect((await deleteCategory(category.id)).action).toBe("deleted");
  });

  it("reorders, and refuses a stale order that misses a row", async () => {
    const all = await listCategories({ includeInactive: true });
    const reversed = all.map((c) => c.id).reverse();
    await reorderCategories(reversed);
    expect((await listCategories({ includeInactive: true })).map((c) => c.id)).toEqual(reversed);
    await expect(reorderCategories(reversed.slice(1))).rejects.toThrow();
    await reorderCategories(all.map((c) => c.id));
  });

  it("rejects a remote image URL that would break next/image", () => {
    expect(categorySchema.safeParse({ name: "آزمون", image: "https://evil.example/x.png" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "آزمون", image: "/uploads/categories/a.webp" }).success).toBe(true);
  });
});

describe("collections", () => {
  it("creates, assigns products, reorders, hides and deletes safely", async () => {
    const collection = await createCollection({ name: `کالکشن آزمون ${stamp}`, description: "زیرعنوان" });
    const { created } = await make({ colors: [{ colorId: tan.id, images: [] }] });

    const result = await assignProductsToCollection(collection.id, [created.id]);
    expect(result.moved).toBe(1);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    expect(product.brandId).toBe(collection.id);
    expect(product.searchText).toContain("کالکشن");

    const listed = (await listBrands()).find((b) => b.id === collection.id);
    expect(listed).toMatchObject({ description: "زیرعنوان", productCount: 1 });
    expect((await searchProducts({ brands: [collection.slug], page: 1 })).items.map((p) => p.id)).toEqual([created.id]);

    const ids = (await prisma.brand.findMany({ orderBy: { position: "asc" } })).map((b) => b.id);
    const moved = [collection.id, ...ids.filter((id) => id !== collection.id)];
    await reorderCollections(moved);
    expect((await listBrands())[0].id).toBe(collection.id);

    // With products in it, delete only hides it; the product stays on sale.
    expect((await deleteCollection(collection.id)).action).toBe("deactivated");
    expect((await listBrands()).some((b) => b.id === collection.id)).toBe(false);
    expect(await getProduct(product.slug)).not.toBeNull();

    // Moving the product out lets it be deleted for real.
    await assignProductsToCollection(base.brandId, [created.id]);
    await updateCollection(collection.id, { active: true });
    expect((await deleteCollection(collection.id)).action).toBe("deleted");
    await reorderCollections(ids.filter((id) => id !== collection.id));
  });
});

describe("free shipping", () => {
  it("starts at 8,000,000 Toman and is then not collected on delivery either", async () => {
    expect(siteConfig.commerce.freeShippingThreshold).toBe(8_000_000);
    const tipax = await prisma.shippingMethod.findUniqueOrThrow({ where: { code: "tipax" } });
    expect(tipax.freeShippingThreshold).toBe(8_000_000);

    const below = await resolveShipping("tipax", 7_999_999);
    expect(below.freeShippingApplied).toBe(false);
    expect(below.paidOnDelivery).toBe(tipax.paidOnDelivery);

    const above = await resolveShipping("tipax", 8_000_000);
    expect(above.freeShippingApplied).toBe(true);
    expect(above.cost).toBe(0);
    expect(above.paidOnDelivery).toBe(false);
  });
});
