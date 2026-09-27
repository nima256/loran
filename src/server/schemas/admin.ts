import { z } from "zod";
import {
  cuidSchema,
  optionalEmailSchema,
  optionalText,
  paginationSchema,
  phoneSchema,
  slugSchema,
  text,
  tomanSchema,
} from "../lib/validation";

/**
 * Admin request schemas.
 *
 * Every field an administrator can write is enumerated here. That is
 * deliberate: a schema that accepted arbitrary keys would let a future form
 * change write a column the service layer never meant to expose.
 */

export const genderSchema = z.enum(["men", "women", "unisex", "kids"]);
export const discountTypeSchema = z.enum(["percent", "fixed"]);

/* ------------------------------------------------------------- products --- */

export const productVariantSchema = z.object({
  id: cuidSchema.optional(),
  colorId: cuidSchema,
  size: z.coerce.number().int().min(10).max(60),
  sku: optionalText(60),
  stock: z.coerce.number().int().min(0).max(100_000),
  price: tomanSchema.nullable().optional(),
  compareAtPrice: tomanSchema.nullable().optional(),
  active: z.boolean().optional(),
});

export const productSchema = z.object({
  name: text(2, 200, "نام محصول را وارد کنید."),
  slug: slugSchema,
  subtitle: optionalText(200),
  brandId: cuidSchema,
  categoryIds: z.array(cuidSchema).min(1, { message: "حداقل یک دسته‌بندی انتخاب کنید." }).max(10),
  gender: genderSchema,
  price: tomanSchema,
  compareAtPrice: tomanSchema.nullable().optional(),
  description: text(0, 5000).default(""),
  features: z.array(text(1, 300)).max(30).default([]),
  specs: z.array(z.object({ label: text(1, 60), value: text(1, 200) })).max(40).default([]),
  tags: z.array(z.enum(["new", "bestseller", "sale", "limited"])).max(4).default([]),
  active: z.boolean().default(true),
  colors: z
    .array(
      z.object({
        colorId: cuidSchema,
        images: z.array(z.string().max(500)).max(12).default([]),
      })
    )
    .min(1, { message: "حداقل یک رنگ برای محصول لازم است." })
    .max(12),
  variants: z.array(productVariantSchema).max(300).default([]),
});

export const productFilterSchema = paginationSchema.extend({
  q: optionalText(120),
  categoryId: optionalText(64),
  brandId: optionalText(64),
  gender: genderSchema.optional(),
  status: z.enum(["active", "inactive"]).optional(),
  stock: z.enum(["in", "low", "out"]).optional(),
  sort: z.enum(["newest", "name", "price-asc", "price-desc", "stock-asc"]).optional(),
});

export const variantStockSchema = z.object({
  stock: z.coerce.number().int().min(0).max(100_000),
});

/* ----------------------------------------------------------- taxonomy ----- */

export const categorySchema = z.object({
  name: text(2, 80, "نام دسته‌بندی را وارد کنید."),
  slug: slugSchema.optional(),
  description: optionalText(500),
  image: optionalText(500),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  position: z.coerce.number().int().min(0).max(999).optional(),
});

export const colorSchema = z.object({
  name: text(1, 60, "نام رنگ را وارد کنید."),
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { message: "کد رنگ باید به شکل #RRGGBB باشد." }),
  hexSecondary: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { message: "کد رنگ دوم باید به شکل #RRGGBB باشد." })
    .nullable()
    .optional(),
  slug: optionalText(60),
  active: z.boolean().optional(),
});

export const sizeSchema = z.object({
  value: z.coerce.number().int().min(10).max(60),
  label: optionalText(20),
});

/* -------------------------------------------------------------- orders ---- */

export const orderFilterSchema = paginationSchema.extend({
  q: optionalText(120),
  status: z
    .enum([
      "awaiting_payment", "preparing", "packaged", "shipped", "delivered",
      "cancelled", "returned", "refunded", "payment_failed", "expired",
    ])
    .optional(),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  source: z.enum(["online", "manual"]).optional(),
  from: optionalText(40),
  to: optionalText(40),
  sort: z.enum(["newest", "oldest", "total-desc", "total-asc"]).optional(),
});

export const orderStatusSchema = z.object({
  status: z.enum([
    "preparing", "packaged", "shipped", "delivered",
    "cancelled", "returned", "refunded",
  ]),
  note: optionalText(300),
});

export const trackingSchema = z.object({
  carrier: text(2, 40, "شرکت حمل را انتخاب کنید."),
  trackingCode: text(4, 60, "کد رهگیری را وارد کنید."),
  notifyCustomer: z.boolean().default(false),
});

export const manualOrderSchema = z.object({
  customer: z.object({
    firstName: text(2, 60, "نام مشتری را وارد کنید."),
    lastName: text(2, 60, "نام خانوادگی مشتری را وارد کنید."),
    phone: optionalText(20),
    email: optionalEmailSchema,
  }),
  address: z
    .object({
      province: optionalText(60),
      city: optionalText(60),
      addressLine: optionalText(300),
      postalCode: optionalText(12),
      plaque: optionalText(10),
      unit: optionalText(10),
      recipientFirstName: optionalText(60),
      recipientLastName: optionalText(60),
      phone: optionalText(20),
    })
    .optional(),
  items: z
    .array(z.object({ variantId: cuidSchema, quantity: z.coerce.number().int().min(1).max(100) }))
    .min(1, { message: "حداقل یک کالا انتخاب کنید." })
    .max(50),
  shippingMethodCode: optionalText(40),
  status: z.enum(["awaiting_payment", "preparing", "packaged", "shipped", "delivered"]),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]),
  paymentMethod: text(1, 40).default("cash"),
  customerNote: optionalText(500),
  adminNote: optionalText(500),
  discount: tomanSchema.optional(),
});

/* ----------------------------------------------------------- customers ---- */

export const adminCustomerSchema = z.object({
  phone: phoneSchema,
  firstName: optionalText(60),
  lastName: optionalText(60),
  email: optionalEmailSchema,
  nationalId: optionalText(12),
  note: optionalText(500),
  blocked: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
});

export const customerFilterSchema = paginationSchema.extend({
  q: optionalText(120),
  status: z.enum(["active", "blocked"]).optional(),
  sort: z.enum(["newest", "orders", "spend"]).optional(),
});

/* ----------------------------------------------------------- discounts ---- */

export const couponSchema = z.object({
  code: text(2, 40, "کد تخفیف را وارد کنید."),
  type: discountTypeSchema,
  value: z.coerce.number().int().min(1),
  maxDiscount: tomanSchema.nullable().optional(),
  minSubtotal: tomanSchema.nullable().optional(),
  description: optionalText(300),
  active: z.boolean().optional(),
  startsAt: optionalText(40).nullable(),
  expiresAt: optionalText(40).nullable(),
  usageLimit: z.coerce.number().int().min(1).nullable().optional(),
  perCustomerLimit: z.coerce.number().int().min(1).nullable().optional(),
});

export const campaignSchema = z.object({
  name: text(2, 120, "نام کمپین را وارد کنید."),
  slug: slugSchema.optional(),
  description: optionalText(500),
  type: discountTypeSchema,
  value: z.coerce.number().int().min(1),
  maxDiscount: tomanSchema.nullable().optional(),
  active: z.boolean().optional(),
  startsAt: optionalText(40).nullable(),
  endsAt: optionalText(40).nullable(),
  priority: z.coerce.number().int().min(0).max(999).optional(),
  productIds: z.array(cuidSchema).max(500).default([]),
});

/* ------------------------------------------------------------- moderation - */

export const reviewModerationSchema = z.object({
  status: z.enum(["approved", "rejected", "pending"]),
  note: optionalText(300),
});

export const returnDecisionSchema = z.object({
  status: z.enum([
    "requested", "info_requested", "approved", "rejected",
    "in_transit", "received", "completed", "refunded", "cancelled",
  ]),
  note: optionalText(300),
  adminNote: optionalText(1000),
});

export const requestUpdateSchema = z.object({
  status: z.enum(["new", "in_progress", "contacted", "completed", "cancelled"]).optional(),
  adminNote: optionalText(1000),
});

export const requestFilterSchema = paginationSchema.extend({
  q: optionalText(120),
  status: z.enum(["new", "in_progress", "contacted", "completed", "cancelled"]).optional(),
});

/* -------------------------------------------------------------- settings -- */

export const shippingMethodSchema = z.object({
  code: optionalText(40),
  name: text(2, 80, "نام روش ارسال را وارد کنید."),
  description: optionalText(500),
  cost: tomanSchema,
  paidOnDelivery: z.boolean(),
  estimate: optionalText(80),
  active: z.boolean().optional(),
  position: z.coerce.number().int().min(0).max(999).optional(),
  freeShippingThreshold: tomanSchema.nullable().optional(),
  supportsTracking: z.boolean().optional(),
});

/**
 * Payment settings, business fields only.
 *
 * There is deliberately no merchant id, key or secret here. Gateway
 * credentials live in the server environment; see `services/settings`.
 */
export const paymentSettingSchema = z.object({
  name: text(2, 80).optional(),
  description: optionalText(500),
  active: z.boolean().optional(),
  position: z.coerce.number().int().min(0).max(99).optional(),
});
