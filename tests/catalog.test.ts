import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import {
  getCategoryCounts, getFacets, getProduct, listBrands, listCategories, searchProducts,
} from "@/server/services/catalog";
import { createManualOrder, searchProductsForManualOrder } from "@/server/services/manual-orders";
import { createProduct, updateProduct } from "@/server/services/admin-products";
import { deleteCategory } from "@/server/services/taxonomy";
import { variantWithStock } from "./helpers";

/**
 * Catalogue reads, the Persian search, and the admin write paths.
 */

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Persian search", () => {
  it("finds products typed with Arabic kaf and yeh", async () => {
    const persian = await searchProducts({ q: "کتانی", page: 1 });
    const arabic = await searchProducts({ q: "كتاني", page: 1 });

    expect(persian.total).toBeGreaterThan(0);
    // The two spellings look identical on screen and must behave identically.
    expect(arabic.total).toBe(persian.total);
  });

  it("finds products typed with Persian digits", async () => {
    const result = await searchProducts({ q: "۵۶۲", page: 1 });
    expect(result.total).toBeGreaterThan(0);
  });

  it("narrows as more words are added", async () => {
    const broad = await searchProducts({ q: "کتانی", page: 1 });
    const narrow = await searchProducts({ q: "کتانی بچگانه", page: 1 });
    expect(narrow.total).toBeLessThanOrEqual(broad.total);
  });

  it("returns nothing for a term that is not in the catalogue", async () => {
    const result = await searchProducts({ q: "زیردریایی", page: 1 });
    expect(result.total).toBe(0);
  });
});

describe("filters", () => {
  it("filters by category slug", async () => {
    const result = await searchProducts({ categories: ["kids"], page: 1 });
    expect(result.total).toBeGreaterThan(0);

    const first = await getProduct(result.items[0].slug);
    const kids = await prisma.category.findFirstOrThrow({ where: { slug: "kids" } });
    expect(first?.categoryIds).toContain(kids.id);
  });

  it("filters by gender", async () => {
    const result = await searchProducts({ genders: ["women"], page: 1 });
    expect(result.items.every((p) => p.gender === "women")).toBe(true);
  });

  it("filters by price range", async () => {
    const result = await searchProducts({ minPrice: 2_000_000, maxPrice: 3_000_000, page: 1 });
    expect(result.items.every((p) => p.price >= 2_000_000 && p.price <= 3_000_000)).toBe(true);
  });

  it("onSale returns only discounted products", async () => {
    const result = await searchProducts({ onSaleOnly: true, page: 1 });
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.every((p) => p.compareAtPrice != null)).toBe(true);
  });

  it("size and colour must be satisfied by the SAME variant", async () => {
    const facets = await getFacets();
    const size = facets.sizes[facets.sizes.length - 1].size;
    const colour = facets.colors[0].id;

    const result = await searchProducts({ sizes: [size], colors: [colour], page: 1 });

    for (const product of result.items) {
      // Not "has this size somewhere AND this colour somewhere" — one variant
      // must have both, or the customer is shown a combination they can't buy.
      const full = await getProduct(product.slug);
      expect(full?.variants.some((v) => v.size === size && v.colorId === colour)).toBe(true);
    }
  });

  it("paginates without losing or repeating products", async () => {
    const page1 = await searchProducts({ page: 1, sort: "newest" });
    const page2 = await searchProducts({ page: 2, sort: "newest" });

    const ids1 = new Set(page1.items.map((p) => p.id));
    expect(page2.items.some((p) => ids1.has(p.id))).toBe(false);
    expect(page1.totalPages).toBe(page2.totalPages);
  });
});

describe("facets", () => {
  it("returns counts for colours, sizes, genders and a price range", async () => {
    const facets = await getFacets();
    expect(facets.colors.length).toBeGreaterThan(0);
    expect(facets.sizes.length).toBeGreaterThan(0);
    expect(facets.genders.length).toBeGreaterThan(0);
    expect(facets.priceRange.min).toBeLessThan(facets.priceRange.max);
    expect(facets.colors.every((c) => c.count > 0)).toBe(true);
  });

  it("category counts agree with a direct query", async () => {
    const counts = await getCategoryCounts();
    const kids = await prisma.category.findFirstOrThrow({ where: { slug: "kids" } });
    const direct = await prisma.product.count({
      where: { active: true, categories: { some: { categoryId: kids.id } } },
    });
    expect(counts.get(kids.id)).toBe(direct);
  });
});

describe("product authoring", () => {
  it("creates a product with its colourways and variant matrix", async () => {
    const [category] = await listCategories();
    const [brand] = await listBrands();
    const colour = await prisma.color.findFirstOrThrow();
    const slug = `test-product-${Date.now()}`;

    const created = await createProduct({
      name: "محصول آزمایشی",
      slug,
      brandId: brand.id,
      categoryIds: [category.id],
      gender: "unisex",
      price: 1_500_000,
      compareAtPrice: null,
      description: "توضیح آزمایشی",
      features: [],
      specs: [],
      tags: [],
      active: true,
      colors: [{ colorId: colour.id, images: ["/products/test.svg"] }],
      variants: [
        { colorId: colour.id, size: 41, stock: 5 },
        { colorId: colour.id, size: 42, stock: 3 },
      ],
    });

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: created.id },
      include: { variants: true, colors: true, categories: true },
    });

    expect(product.variants).toHaveLength(2);
    expect(product.colors).toHaveLength(1);
    expect(product.categories).toHaveLength(1);
    // The search index is written on create, so the product is findable at once.
    expect(product.searchText).toContain("محصول ازمایشی");

    await prisma.product.delete({ where: { id: created.id } });
  });

  it("refuses a duplicate colour/size variant", async () => {
    const [category] = await listCategories();
    const [brand] = await listBrands();
    const colour = await prisma.color.findFirstOrThrow();

    await expect(
      createProduct({
        name: "تکراری", slug: `dup-${Date.now()}`, brandId: brand.id,
        categoryIds: [category.id], gender: "unisex", price: 1_000_000,
        compareAtPrice: null, description: "", features: [], specs: [], tags: [],
        active: true,
        colors: [{ colorId: colour.id, images: [] }],
        variants: [
          { colorId: colour.id, size: 41, stock: 1 },
          { colorId: colour.id, size: 41, stock: 2 },
        ],
      })
    ).rejects.toThrow(/فقط یک تنوع/);
  });

  it("refuses a compare-at price that is not actually higher", async () => {
    const [category] = await listCategories();
    const [brand] = await listBrands();
    const colour = await prisma.color.findFirstOrThrow();

    await expect(
      createProduct({
        name: "قیمت اشتباه", slug: `bad-price-${Date.now()}`, brandId: brand.id,
        categoryIds: [category.id], gender: "unisex",
        price: 2_000_000, compareAtPrice: 1_000_000,
        description: "", features: [], specs: [], tags: [], active: true,
        colors: [{ colorId: colour.id, images: [] }],
        variants: [],
      })
    ).rejects.toThrow(/بیشتر از قیمت فعلی/);
  });

  it("deactivates rather than deletes a variant that appears in an order", async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { orderItems: { some: {} } },
      include: { product: { include: { colors: true, categories: true, variants: true } }, size: true },
    });
    const product = variant.product;

    // Save the product back without that variant.
    const sizes = await prisma.size.findMany({
      where: { id: { in: product.variants.map((v) => v.sizeId) } },
    });
    const sizeById = new Map(sizes.map((s) => [s.id, s.value]));

    await updateProduct(product.id, {
      name: product.name,
      slug: product.slug,
      brandId: product.brandId,
      categoryIds: product.categories.map((c) => c.categoryId),
      gender: product.gender,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      description: product.description,
      features: product.features,
      specs: (product.specs as { label: string; value: string }[]) ?? [],
      tags: product.tags,
      active: product.active,
      colors: product.colors.map((c) => ({ colorId: c.colorId, images: c.images })),
      variants: product.variants
        .filter((v) => v.id !== variant.id)
        .map((v) => ({ colorId: v.colorId, size: sizeById.get(v.sizeId)!, stock: v.stock })),
    });

    const after = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    // Still there — an old invoice has to keep resolving.
    expect(after).not.toBeNull();
    expect(after!.active).toBe(false);
    expect(after!.stock).toBe(0);

    // Put it back so the rest of the suite sees the seeded catalogue.
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { active: true, stock: 5 },
    });
  });
});

describe("category deletion policy", () => {
  it("deactivates a category that still has products instead of orphaning them", async () => {
    const category = await prisma.category.findFirstOrThrow({
      where: { products: { some: {} }, active: true },
    });

    const result = await deleteCategory(category.id);
    expect(result.action).toBe("deactivated");

    const after = await prisma.category.findUniqueOrThrow({ where: { id: category.id } });
    expect(after.active).toBe(false);
    // The products are untouched, not uncategorised.
    const stillLinked = await prisma.productCategory.count({ where: { categoryId: category.id } });
    expect(stillLinked).toBeGreaterThan(0);

    await prisma.category.update({ where: { id: category.id }, data: { active: true } });
  });
});

describe("manual orders", () => {
  it("decrements stock and behaves like any other order", async () => {
    const variant = await variantWithStock(5);

    const result = await createManualOrder({
      customer: { firstName: "مریم", lastName: "کاظمی", phone: "۰۹۱۳۲۲۲۳۳۴۴" },
      items: [{ variantId: variant.id, quantity: 2 }],
      status: "preparing",
      paymentStatus: "paid",
      paymentMethod: "cash",
    });

    const after = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(after.stock).toBe(3);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.id },
      include: { items: true, events: true },
    });
    expect(order.source).toBe("manual");
    // The Persian-digit phone was normalised on the way in.
    expect(order.customerPhone).toBe("09132223344");
    // Price came from the database, not the form.
    expect(order.items[0].unitPrice).toBe(variant.product.price);
    expect(order.events).toHaveLength(1);

    await prisma.order.delete({ where: { id: result.id } });
    await variantWithStock(10);
  });

  it("refuses an order for more than the stock on hand", async () => {
    const variant = await variantWithStock(2);

    await expect(
      createManualOrder({
        customer: { firstName: "تست", lastName: "کمبود" },
        items: [{ variantId: variant.id, quantity: 50 }],
        status: "preparing",
        paymentStatus: "pending",
        paymentMethod: "cash",
      })
    ).rejects.toThrow(/موجودی/);

    // Nothing was taken from the shelf.
    const after = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(after.stock).toBe(2);

    await variantWithStock(10);
  });

  it("the product picker reports live stock per variant", async () => {
    const products = await searchProductsForManualOrder("", 3);
    expect(products.length).toBeGreaterThan(0);
    const variants = products[0].variants;
    expect(variants.length).toBeGreaterThan(0);
    expect(variants.every((v) => v.inStock === v.stock > 0)).toBe(true);
  });
});
