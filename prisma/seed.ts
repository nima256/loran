/**
 * Seeds PostgreSQL from the reference catalogue in `src/data/catalog.json`.
 *
 * The JSON is *input* to this script only — once seeded, nothing at runtime
 * reads it. The original identifiers (`p-001`, `c-sneaker`, `col-tan`) are kept
 * as primary keys so seeded rows stay readable and re-running the seed updates
 * in place instead of duplicating.
 *
 * Idempotent: every write is an upsert, so `npm run db:seed` is safe to repeat.
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { hash as argonHash } from "@node-rs/argon2";

const prisma = new PrismaClient();

const root = path.join(process.cwd());
const catalog = JSON.parse(
  readFileSync(path.join(root, "src/data/catalog.json"), "utf8")
) as CatalogFile;

/* ---------------------------------------------------------------- shapes -- */

interface CatalogFile {
  categories: { id: string; slug: string; name: string; description?: string; featured?: boolean }[];
  brands: { id: string; slug: string; name: string }[];
  products: SeedProduct[];
  reviews: SeedReview[];
}

interface SeedProduct {
  id: string;
  slug: string;
  name: string;
  subtitle?: string;
  brandId: string;
  categoryIds: string[];
  gender: "men" | "women" | "unisex" | "kids";
  price: number;
  compareAtPrice?: number;
  colors: { id: string; name: string; hex: string; hexSecondary?: string; images: string[] }[];
  variants: { id: string; sku: string; colorId: string; size: number; stock: number; price?: number; compareAtPrice?: number }[];
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
  rating: number;
  reviewCount: number;
  soldCount: number;
  tags: string[];
  createdAt: string;
}

interface SeedReview {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  title?: string;
  body: string;
  createdAt: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  purchasedVariant?: { colorName: string; size: number };
  sizeFeedback?: "small" | "true" | "large";
}

/* ------------------------------------------------------------- helpers ---- */

/** Mirrors `src/lib/persian.ts` — duplicated so the seed runs without the app. */
function normalizePersian(value: string): string {
  return String(value)
    .replace(/[\u06F0-\u06F9]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[\u0660-\u0669]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .toLowerCase()
    .replace(/[\u064A\u0649\uFEF1\uFEF2\uFEF3\uFEF4]/g, "ی")
    .replace(/[\u0643\uFED9\uFEDA\uFEDB\uFEDC]/g, "ک")
    .replace(/[\u0629\u06C0]/g, "ه")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "ا")
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[\u200B-\u200F\u2028\u2029\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SIZE_FEEDBACK = { small: "small", true: "true_to_size", large: "large" } as const;

async function main() {
  console.log("→ seeding reference data");

  /* ------------------------------------------------------------ colours -- */
  const colorSeeds = new Map<string, { id: string; name: string; hex: string; hexSecondary?: string }>();
  for (const product of catalog.products) {
    for (const color of product.colors) {
      if (!colorSeeds.has(color.id)) {
        colorSeeds.set(color.id, {
          id: color.id,
          name: color.name,
          hex: color.hex,
          hexSecondary: color.hexSecondary,
        });
      }
    }
  }
  let colorPosition = 0;
  for (const color of colorSeeds.values()) {
    const data = {
      slug: color.id.replace(/^col-/, ""),
      name: color.name,
      hex: color.hex,
      hexSecondary: color.hexSecondary ?? null,
      position: colorPosition++,
    };
    await prisma.color.upsert({ where: { id: color.id }, create: { id: color.id, ...data }, update: data });
  }
  console.log(`  colours: ${colorSeeds.size}`);

  /* -------------------------------------------------------------- sizes -- */
  const sizeValues = [...new Set(catalog.products.flatMap((p) => p.variants.map((v) => v.size)))].sort(
    (a, b) => a - b
  );
  const sizeIdByValue = new Map<number, string>();
  for (const [index, value] of sizeValues.entries()) {
    const id = `size-${value}`;
    const data = { value, label: String(value), position: index };
    await prisma.size.upsert({ where: { id }, create: { id, ...data }, update: data });
    sizeIdByValue.set(value, id);
  }
  console.log(`  sizes: ${sizeValues.length}`);

  /* --------------------------------------------------------- categories -- */
  for (const [index, category] of catalog.categories.entries()) {
    const data = {
      slug: category.slug,
      name: category.name,
      description: category.description ?? null,
      featured: category.featured ?? false,
      position: index,
    };
    await prisma.category.upsert({
      where: { id: category.id },
      create: { id: category.id, ...data },
      update: data,
    });
  }
  console.log(`  categories: ${catalog.categories.length}`);

  /* ------------------------------------------------------------- brands -- */
  for (const brand of catalog.brands) {
    const data = { slug: brand.slug, name: brand.name };
    await prisma.brand.upsert({ where: { id: brand.id }, create: { id: brand.id, ...data }, update: data });
  }
  console.log(`  brands: ${catalog.brands.length}`);

  /* ----------------------------------------------------------- products -- */
  const categoryNameById = new Map(catalog.categories.map((c) => [c.id, c.name]));
  const brandNameById = new Map(catalog.brands.map((b) => [b.id, b.name]));

  for (const product of catalog.products) {
    const searchText = normalizePersian(
      [
        product.name,
        product.subtitle ?? "",
        brandNameById.get(product.brandId) ?? "",
        ...product.colors.map((c) => c.name),
        ...product.categoryIds.map((id) => categoryNameById.get(id) ?? ""),
        product.description,
        ...product.features,
        ...product.specs.map((s) => `${s.label} ${s.value}`),
      ].join(" ")
    );

    const data = {
      slug: product.slug,
      name: product.name,
      subtitle: product.subtitle ?? null,
      brandId: product.brandId,
      gender: product.gender,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? null,
      description: product.description,
      features: product.features,
      specs: product.specs as unknown as Prisma.InputJsonValue,
      tags: product.tags,
      rating: product.rating,
      reviewCount: product.reviewCount,
      soldCount: product.soldCount,
      active: true,
      searchText,
      createdAt: new Date(product.createdAt),
    };

    await prisma.product.upsert({
      where: { id: product.id },
      create: { id: product.id, ...data },
      update: data,
    });

    // Category links — replaced wholesale so a re-seed drops stale rows.
    await prisma.productCategory.deleteMany({ where: { productId: product.id } });
    await prisma.productCategory.createMany({
      data: product.categoryIds.map((categoryId) => ({ productId: product.id, categoryId })),
      skipDuplicates: true,
    });

    // Colourways.
    for (const [index, color] of product.colors.entries()) {
      const productColorId = `${product.id}-${color.id}`;
      const pcData = { images: color.images, position: index };
      await prisma.productColor.upsert({
        where: { id: productColorId },
        create: { id: productColorId, productId: product.id, colorId: color.id, ...pcData },
        update: pcData,
      });
    }

    // Variants.
    for (const variant of product.variants) {
      const sizeId = sizeIdByValue.get(variant.size);
      if (!sizeId) continue;
      const vData = {
        productId: product.id,
        productColorId: `${product.id}-${variant.colorId}`,
        colorId: variant.colorId,
        sizeId,
        sku: variant.sku,
        stock: variant.stock,
        price: variant.price ?? null,
        compareAtPrice: variant.compareAtPrice ?? null,
        active: true,
      };
      await prisma.productVariant.upsert({
        where: { id: variant.id },
        create: { id: variant.id, ...vData },
        update: vData,
      });
    }
  }
  console.log(`  products: ${catalog.products.length}`);

  /* ------------------------------------------------------------ reviews -- */
  // Seeded reviews are pre-moderated as approved so the storefront has real
  // rating data to display; new customer reviews still default to `pending`.
  for (const review of catalog.reviews) {
    const data = {
      productId: review.productId,
      authorName: review.authorName,
      rating: Math.round(review.rating),
      title: review.title ?? null,
      body: review.body,
      status: "approved" as const,
      verifiedPurchase: review.verifiedPurchase,
      helpfulCount: review.helpfulCount,
      purchasedColorName: review.purchasedVariant?.colorName ?? null,
      purchasedSize: review.purchasedVariant?.size ?? null,
      sizeFeedback: review.sizeFeedback ? SIZE_FEEDBACK[review.sizeFeedback] : null,
      moderatedAt: new Date(review.createdAt),
      createdAt: new Date(review.createdAt),
    };
    await prisma.review.upsert({
      where: { id: review.id },
      create: { id: review.id, ...data },
      update: data,
    });
  }
  console.log(`  reviews: ${catalog.reviews.length}`);

  // Recompute the aggregates from the approved rows so the seeded numbers and
  // the moderation logic agree from the first request.
  await recomputeAllRatings();

  /* -------------------------------------------------- shipping & payment -- */
  const shippingMethods = [
    {
      code: "tipax",
      name: "تیپاکس (پس‌کرایه)",
      description:
        "ارسال به سراسر ایران. هزینه ارسال هنگام تحویل مرسوله نزد مأمور تیپاکس پرداخت می‌شود.",
      cost: 0,
      paidOnDelivery: true,
      estimate: "۲ تا ۴ روز کاری",
      active: true,
      position: 0,
      supportsTracking: true,
      freeShippingThreshold: null,
    },
    {
      code: "post",
      name: "پست پیشتاز",
      description: "ارسال با پست پیشتاز جمهوری اسلامی ایران.",
      cost: 85_000,
      paidOnDelivery: false,
      estimate: "۳ تا ۷ روز کاری",
      active: false,
      position: 1,
      supportsTracking: true,
      freeShippingThreshold: 3_500_000,
    },
    {
      code: "courier",
      name: "پیک فوری (ویژه یزد)",
      description: "تحویل همان روز در محدوده شهر یزد.",
      cost: 120_000,
      paidOnDelivery: false,
      estimate: "همان روز",
      active: false,
      position: 2,
      supportsTracking: false,
      freeShippingThreshold: null,
    },
  ];
  for (const method of shippingMethods) {
    await prisma.shippingMethod.upsert({
      where: { code: method.code },
      create: method,
      update: {
        // Name/description/estimate are administrator-editable, so a re-seed
        // must not overwrite them. Only structural defaults are refreshed.
        supportsTracking: method.supportsTracking,
      },
    });
  }

  await prisma.paymentMethodSetting.upsert({
    where: { code: "zarinpal" },
    create: {
      code: "zarinpal",
      name: "پرداخت اینترنتی (زرین‌پال)",
      description: "پرداخت امن با کارت‌های عضو شتاب از طریق درگاه زرین‌پال.",
      active: true,
      position: 0,
    },
    update: {},
  });
  console.log("  shipping + payment settings");

  /* ------------------------------------------------------------ coupons -- */
  const coupons = [
    {
      code: "LORAN10",
      type: "percent" as const,
      value: 10,
      maxDiscount: 400_000,
      description: "۱۰٪ تخفیف تا سقف ۴۰۰٬۰۰۰ تومان",
      perCustomerLimit: 1,
    },
    {
      code: "WELCOME",
      type: "fixed" as const,
      value: 200_000,
      minSubtotal: 1_500_000,
      description: "۲۰۰٬۰۰۰ تومان تخفیف اولین خرید (از ۱٬۵۰۰٬۰۰۰ تومان به بالا)",
      perCustomerLimit: 1,
    },
  ];
  for (const coupon of coupons) {
    await prisma.coupon.upsert({ where: { code: coupon.code }, create: coupon, update: {} });
  }
  console.log(`  coupons: ${coupons.length}`);

  /* -------------------------------------------------------------- admin -- */
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await argonHash(adminPassword);
    await prisma.adminUser.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, passwordHash, name: "مدیر لوران" },
      // Re-seeding rotates the password to whatever the environment now holds,
      // which is how the operator recovers a forgotten one.
      update: { passwordHash, active: true },
    });
    console.log(`  admin: ${adminEmail}`);
  } else {
    console.log("  admin: skipped (ADMIN_EMAIL / ADMIN_PASSWORD not set)");
  }

  console.log("✓ seed complete");
}

/**
 * Recomputes `rating`/`reviewCount` on every product from approved reviews.
 *
 * The LEFT JOIN matters: a product whose reviews were all rejected (or that
 * never had any) must be reset to zero, not left holding a stale count.
 */
async function recomputeAllRatings() {
  await prisma.$executeRaw`
    UPDATE products p SET
      "rating"      = COALESCE(agg.avg_rating, 0),
      "reviewCount" = COALESCE(agg.total, 0)
    FROM products base
    LEFT JOIN (
      SELECT "productId", ROUND(AVG("rating")::numeric, 1)::float8 AS avg_rating, COUNT(*)::int AS total
      FROM reviews WHERE "status" = 'approved' GROUP BY "productId"
    ) AS agg ON agg."productId" = base.id
    WHERE p.id = base.id
  `;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
