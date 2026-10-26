import "server-only";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { badRequest, notFound } from "../lib/errors";
import { normalizeIranMobile } from "@/lib/persian";
import { toPersianDigits } from "@/lib/format";
import { createOrder } from "./orders";
import { effectivePricing } from "./pricing";
import { loadCampaignPricing } from "./catalog";
import { resolveShipping } from "./shipping";
import type { PricedCartLine } from "./cart";
import type { OrderTotals } from "@/types";

/**
 * Manually entered orders — taken by phone, Instagram, WhatsApp or in person.
 *
 * These are ordinary orders. They use the same `orders` and `order_items`
 * tables, appear in the same lists, reports and packing slips, and move through
 * the same status workflow. The only difference is `source = "manual"`, which
 * exists so reporting can tell the two apart later without a second system.
 *
 * Inventory behaves exactly as it does online: a manual order for 2 units of a
 * variant with 5 in stock leaves 3, persisted in PostgreSQL, and the storefront
 * reflects it immediately. Creation and the stock decrement share one
 * transaction, so they succeed or fail together and stock can never go negative.
 *
 * Nothing the admin form sends about money is trusted. Prices are reloaded from
 * the database, exactly as they are for an online checkout.
 */

export interface ManualOrderLineInput {
  variantId: string;
  quantity: number;
}

export interface ManualOrderInput {
  customer: {
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
  };
  address?: {
    province?: string;
    city?: string;
    addressLine?: string;
    postalCode?: string;
    plaque?: string;
    unit?: string;
    recipientFirstName?: string;
    recipientLastName?: string;
    phone?: string;
  };
  items: ManualOrderLineInput[];
  shippingMethodCode?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  customerNote?: string;
  adminNote?: string;
  /** Optional manual discount, in Tomans, applied to the subtotal. */
  discount?: number;
}

export interface ManualOrderResult {
  id: string;
  number: string;
  customerId: string | null;
  /** Variant stock after the order, for the confirmation message. */
  stockAfter: { variantId: string; name: string; stock: number }[];
}

/** Statuses a manual order may be created in. */
export const MANUAL_ORDER_STATUSES: OrderStatus[] = [
  "awaiting_payment",
  "preparing",
  "packaged",
  "shipped",
  "delivered",
];

export async function createManualOrder(input: ManualOrderInput): Promise<ManualOrderResult> {
  if (!input.items.length) throw badRequest("حداقل یک کالا برای سفارش انتخاب کنید.");
  if (!MANUAL_ORDER_STATUSES.includes(input.status)) {
    throw badRequest("وضعیت انتخاب‌شده برای ثبت دستی سفارش معتبر نیست.");
  }

  const phone = input.customer.phone ? normalizeIranMobile(input.customer.phone) : "";
  if (input.customer.phone && !phone) {
    throw badRequest("شماره موبایل مشتری معتبر نیست.");
  }

  /* --- Reload variants and prices from the database -------------------- */
  const merged = new Map<string, number>();
  for (const line of input.items) {
    const quantity = Math.floor(line.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw badRequest("تعداد هر کالا باید حداقل ۱ باشد.");
    }
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + quantity);
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [...merged.keys()] } },
    include: {
      product: true,
      productColor: { include: { color: true } },
      size: true,
    },
  });

  if (variants.length !== merged.size) {
    throw notFound("یکی از تنوع‌های انتخاب‌شده پیدا نشد.");
  }

  const campaigns = await loadCampaignPricing([...new Set(variants.map((v) => v.productId))]);
  const items: PricedCartLine[] = [];

  for (const variant of variants) {
    const quantity = merged.get(variant.id)!;
    // Persian digits: this label reaches the administrator's screen.
    const label = `${variant.product.name} (${variant.productColor.color.name}، سایز ${toPersianDigits(variant.size.value)})`;

    if (!variant.active || !variant.product.active) {
      throw badRequest(`«${label}» غیرفعال است و نمی‌توان برای آن سفارش ثبت کرد.`);
    }
    // Checked here for a clear message; the atomic decrement below is what
    // actually guarantees stock never goes negative.
    if (variant.stock < quantity) {
      throw badRequest(
        `موجودی «${label}» کافی نیست. موجودی فعلی: ${toPersianDigits(variant.stock)}، درخواست: ${toPersianDigits(quantity)}.`
      );
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
      maxQuantity: variant.stock,
      lineTotal: pricing.price * quantity,
      inStock: true,
    });
  }

  /* --- Totals, computed server-side ------------------------------------ */
  const subtotal = items.reduce((n, i) => n + i.lineTotal, 0);
  const compareSubtotal = items.reduce(
    (n, i) => n + (i.compareAtPrice ?? i.price) * i.quantity,
    0
  );
  const discount = Math.max(0, Math.min(input.discount ?? 0, subtotal));
  const afterDiscount = subtotal - discount;
  const shipping = await resolveShipping(input.shippingMethodCode, afterDiscount);

  const totals: OrderTotals = {
    subtotal,
    productDiscount: compareSubtotal - subtotal,
    couponDiscount: discount,
    shippingCost: shipping.cost,
    payableOnline: shipping.paidOnDelivery ? afterDiscount : afterDiscount + shipping.cost,
    grandTotal: afterDiscount + shipping.cost,
  };

  /* --- Link to an existing customer when the phone matches -------------- */
  // Matching an existing account keeps the order in that customer's history.
  // No account is created for an unknown number: a customer signs in with OTP,
  // and inventing a password or a fake verification for them would be worse
  // than leaving the order attached to its snapshot alone.
  const customerId = phone
    ? (await prisma.customer.findUnique({ where: { phone }, select: { id: true } }))?.id ?? null
    : null;

  const address = input.address ?? {};

  const order = await createOrder(
    {
      source: "manual",
      customerId,
      customer: {
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        phone: phone || "-",
        email: input.customer.email ?? null,
      },
      address: {
        recipientFirstName: address.recipientFirstName || input.customer.firstName,
        recipientLastName: address.recipientLastName || input.customer.lastName,
        phone: address.phone ? normalizeIranMobile(address.phone) || phone || "-" : phone || "-",
        province: address.province || "-",
        city: address.city || "-",
        addressLine: address.addressLine || "-",
        postalCode: address.postalCode || "-",
        plaque: address.plaque ?? null,
        unit: address.unit ?? null,
      },
      shipping: {
        id: shipping.id,
        code: shipping.code,
        name: shipping.name,
        paidOnDelivery: shipping.paidOnDelivery,
      },
      items,
      totals,
      coupon: null,
      customerNote: input.customerNote,
      adminNote: input.adminNote,
      paymentMethod: input.paymentMethod,
      status: input.status,
      // A manual order is taken by phone; no automated SMS is implied.
      smsNotifications: false,
    },
    // Stock is committed immediately: unlike an online order there is no
    // pending payment to wait on, the goods are being set aside now.
    { commitStock: true }
  );

  /* --- Payment state and sold counts ----------------------------------- */
  if (input.paymentStatus !== "pending") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: input.paymentStatus,
        ...(input.paymentStatus === "paid"
          ? { paidAt: new Date(), finalizedAt: new Date(), paymentRef: "MANUAL" }
          : {}),
      },
    });
  }

  if (input.paymentStatus === "paid") {
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { soldCount: { increment: item.quantity } },
      });
    }
  }

  const after = await prisma.productVariant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    select: { id: true, stock: true },
  });
  const stockById = new Map(after.map((v) => [v.id, v.stock]));

  return {
    id: order.id,
    number: order.number,
    customerId,
    stockAfter: items.map((i) => ({
      variantId: i.variantId,
      name: `${i.name} (${i.colorName}، ${i.size})`,
      stock: stockById.get(i.variantId) ?? 0,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Product picker                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Products and their in-stock variants, for the manual-order form.
 *
 * Returns live stock against every colour/size so the administrator cannot pick
 * an unavailable combination in the first place — the server still re-checks on
 * submit, but the form shouldn't invite the mistake.
 */
export async function searchProductsForManualOrder(query: string, limit = 12) {
  const q = query.trim();
  const rows = await prisma.product.findMany({
    where: {
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { soldCount: "desc" },
    take: limit,
    include: {
      colors: { include: { color: true }, orderBy: { position: "asc" } },
      variants: {
        where: { active: true },
        include: { size: true, color: true },
        orderBy: { sizeId: "asc" },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.price,
    image: row.colors[0]?.images[0] ?? "",
    colors: row.colors.map((c) => ({
      id: c.colorId,
      name: c.color.name,
      hex: c.color.hex,
      image: c.images[0] ?? "",
    })),
    variants: row.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      colorId: v.colorId,
      colorName: v.color.name,
      size: v.size.value,
      stock: v.stock,
      price: v.price ?? row.price,
      inStock: v.stock > 0,
    })),
  }));
}

export type ManualOrderProduct = Awaited<
  ReturnType<typeof searchProductsForManualOrder>
>[number];
