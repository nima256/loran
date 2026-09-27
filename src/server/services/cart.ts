import "server-only";
import { prisma, type Db } from "../lib/prisma";
import { badRequest } from "../lib/errors";
import { effectivePricing } from "./pricing";
import { loadCampaignPricing } from "./catalog";
import { validateCoupon } from "./coupons";
import { resolveShipping, type ResolvedShipping } from "./shipping";
import { toPersianDigits } from "@/lib/format";
import type { OrderTotals } from "@/types";

/**
 * Server-side cart validation and repricing.
 *
 * The browser keeps a cart in localStorage, but that cart is a *snapshot*, not
 * a source of truth. It tells the server which variants and how many; every
 * other number — price, stock, limits, discounts, totals — is loaded fresh from
 * PostgreSQL here.
 *
 * Nothing the client sends about money is read. If the client claims a price,
 * it is ignored rather than rejected, so an old tab simply re-prices instead of
 * erroring.
 *
 * The same function backs three surfaces, which is what keeps them agreeing:
 * opening the cart, the checkout summary, and order creation.
 */

/** What the client is allowed to tell us about a line. */
export interface CartLineInput {
  variantId: string;
  quantity: number;
}

export type CartIssueCode =
  | "unavailable"
  | "out_of_stock"
  | "reduced_quantity"
  | "price_changed";

export interface CartIssue {
  variantId: string;
  code: CartIssueCode;
  /** A Persian sentence naming the product and what changed. */
  message: string;
}

export interface PricedCartLine {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  image: string;
  colorId: string;
  colorName: string;
  colorHex: string;
  size: number;
  sku: string;
  /** The authoritative unit price. */
  price: number;
  compareAtPrice?: number;
  quantity: number;
  /** How many the customer may buy — the variant's stock, capped per order. */
  maxQuantity: number;
  lineTotal: number;
  inStock: boolean;
}

export interface ValidatedCart {
  items: PricedCartLine[];
  /** Lines that were dropped entirely (product gone, or nothing in stock). */
  removed: { variantId: string; name: string; reason: CartIssueCode }[];
  /** Everything the customer should be told about before they pay. */
  issues: CartIssue[];
  totals: OrderTotals;
  coupon: { code: string; discount: number; description: string } | null;
  couponError: string | null;
  shipping: ResolvedShipping;
}

/** Nobody needs 50 of one shoe; this also caps the blast radius of a bad client. */
export const MAX_QUANTITY_PER_LINE = 10;

export interface ValidateCartOptions {
  lines: CartLineInput[];
  couponCode?: string | null;
  shippingMethodCode?: string;
  customerId?: string | null;
  /**
   * Prices the client last displayed, keyed by variant. Used *only* to detect
   * that a price moved so the customer can be told — never to decide a charge.
   */
  displayedPrices?: Record<string, number>;
  db?: Db;
}

export async function validateCart(options: ValidateCartOptions): Promise<ValidatedCart> {
  const db = options.db ?? prisma;
  const requested = dedupe(options.lines);

  const variants = requested.length
    ? await db.productVariant.findMany({
        where: { id: { in: requested.map((l) => l.variantId) } },
        include: {
          product: { include: { brand: true } },
          productColor: { include: { color: true } },
          size: true,
        },
      })
    : [];

  const byId = new Map(variants.map((v) => [v.id, v]));
  const campaigns = await loadCampaignPricing([...new Set(variants.map((v) => v.productId))]);

  const items: PricedCartLine[] = [];
  const removed: ValidatedCart["removed"] = [];
  const issues: CartIssue[] = [];

  for (const line of requested) {
    const variant = byId.get(line.variantId);

    // The variant vanished, or the product was archived since it was added.
    if (!variant || !variant.active || !variant.product.active) {
      removed.push({
        variantId: line.variantId,
        name: variant?.product.name ?? "کالای حذف‌شده",
        reason: "unavailable",
      });
      issues.push({
        variantId: line.variantId,
        code: "unavailable",
        message: `«${variant?.product.name ?? "یکی از کالاها"}» دیگر در دسترس نیست و از سبد حذف شد.`,
      });
      continue;
    }

    // Persian digits throughout: these strings are shown to the customer.
    const label = `${variant.product.name} (${variant.productColor.color.name}، سایز ${toPersianDigits(variant.size.value)})`;

    if (variant.stock <= 0) {
      removed.push({ variantId: variant.id, name: variant.product.name, reason: "out_of_stock" });
      issues.push({
        variantId: variant.id,
        code: "out_of_stock",
        message: `«${label}» ناموجود شد و از سبد حذف شد.`,
      });
      continue;
    }

    const maxQuantity = Math.min(variant.stock, MAX_QUANTITY_PER_LINE);
    const quantity = Math.max(1, Math.min(line.quantity, maxQuantity));
    if (quantity < line.quantity) {
      issues.push({
        variantId: variant.id,
        code: "reduced_quantity",
        message: `از «${label}» فقط ${toPersianDigits(quantity)} عدد موجود است؛ تعداد سبد اصلاح شد.`,
      });
    }

    const pricing = effectivePricing(
      {
        id: variant.productId,
        price: variant.product.price,
        compareAtPrice: variant.product.compareAtPrice,
        variantPrice: variant.price,
        variantCompareAtPrice: variant.compareAtPrice,
      },
      campaigns
    );

    // Tell the customer when the price moved under them, rather than quietly
    // charging a different amount than the one they last saw.
    const shown = options.displayedPrices?.[variant.id];
    if (shown != null && shown !== pricing.price) {
      issues.push({
        variantId: variant.id,
        code: "price_changed",
        message:
          pricing.price > shown
            ? `قیمت «${label}» افزایش یافته است.`
            : `قیمت «${label}» کاهش یافته است.`,
      });
    }

    items.push({
      productId: variant.productId,
      variantId: variant.id,
      slug: variant.product.slug,
      name: variant.product.name,
      image: variant.productColor.images[0] ?? "",
      colorId: variant.colorId,
      colorName: variant.productColor.color.name,
      colorHex: variant.productColor.color.hex,
      size: variant.size.value,
      sku: variant.sku,
      price: pricing.price,
      compareAtPrice: pricing.compareAtPrice ?? undefined,
      quantity,
      maxQuantity,
      lineTotal: pricing.price * quantity,
      inStock: true,
    });
  }

  /* ----------------------------------------------------------- totals ---- */

  const subtotal = items.reduce((n, i) => n + i.lineTotal, 0);
  const compareSubtotal = items.reduce(
    (n, i) => n + (i.compareAtPrice ?? i.price) * i.quantity,
    0
  );
  const productDiscount = compareSubtotal - subtotal;

  let coupon: ValidatedCart["coupon"] = null;
  let couponError: string | null = null;
  let couponDiscount = 0;

  if (options.couponCode && subtotal > 0) {
    try {
      const result = await validateCoupon(options.couponCode, subtotal, options.customerId, db);
      couponDiscount = result.discount;
      coupon = {
        code: result.coupon.code,
        discount: result.discount,
        description: result.coupon.description,
      };
    } catch (error) {
      // A coupon that stopped qualifying (the cart shrank, it expired) must not
      // block the cart — the customer is told and the total is simply correct.
      couponError =
        error instanceof Error ? error.message : "کد تخفیف دیگر قابل استفاده نیست.";
    }
  }

  const afterCoupon = Math.max(0, subtotal - couponDiscount);
  const shipping = await resolveShipping(options.shippingMethodCode, afterCoupon);

  const totals: OrderTotals = {
    subtotal,
    productDiscount,
    couponDiscount,
    shippingCost: shipping.cost,
    // Postpaid shipping is collected by the courier, so it never forms part of
    // the amount sent to the payment gateway.
    payableOnline: shipping.paidOnDelivery ? afterCoupon : afterCoupon + shipping.cost,
    grandTotal: afterCoupon + shipping.cost,
  };

  return { items, removed, issues, totals, coupon, couponError, shipping };
}

/** Merges duplicate lines and drops anything malformed. */
function dedupe(lines: CartLineInput[]): CartLineInput[] {
  const merged = new Map<string, number>();
  for (const line of lines) {
    if (!line?.variantId || typeof line.quantity !== "number") continue;
    const quantity = Math.floor(line.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) continue;
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + quantity);
  }
  if (merged.size > 50) {
    throw badRequest("تعداد اقلام سبد خرید بیش از حد مجاز است.");
  }
  return [...merged.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
}
