/**
 * Domain model for the Loran storefront.
 *
 * These types are the contract the future backend should satisfy. Everything the
 * UI renders comes from here, so swapping `src/data/*` for real API responses is
 * the only change required — no component reaches into mock data directly.
 *
 * Money is stored as an integer number of **Tomans**. Never floats.
 */

export type ID = string;

/* -------------------------------------------------------------------------- */
/* Catalog                                                                     */
/* -------------------------------------------------------------------------- */

export type Gender = "men" | "women" | "unisex" | "kids";

export interface Category {
  id: ID;
  slug: string;
  name: string;
  description?: string;
  image?: string;
  /** Rendered as a category tile on the homepage when true. */
  featured?: boolean;
  productCount?: number;
}

export interface Brand {
  id: ID;
  slug: string;
  name: string;
}

/** A colour option of a product. Each colour carries its own gallery. */
export interface ProductColor {
  id: ID;
  /** Persian label, e.g. «مشکی». */
  name: string;
  /** CSS colour for the swatch. Two-tone colourways use `hexSecondary`. */
  hex: string;
  hexSecondary?: string;
  images: string[];
}

/**
 * Stock lives on the variant — the (colour × size) pair — never on the product.
 * `Black/41` being in stock while `Black/42` is sold out must be representable.
 */
export interface ProductVariant {
  id: ID;
  sku: string;
  colorId: ID;
  /** EU shoe size as a number so it can be sorted and compared. */
  size: number;
  stock: number;
  /** Set only when this variant is priced differently from the product. */
  price?: number;
  compareAtPrice?: number;
}

export interface Product {
  id: ID;
  slug: string;
  name: string;
  subtitle?: string;
  brandId: ID;
  categoryIds: ID[];
  gender: Gender;
  /** Current price in Tomans. */
  price: number;
  /** Pre-discount price. Present only while the product is on sale. */
  compareAtPrice?: number;
  colors: ProductColor[];
  variants: ProductVariant[];
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
  rating: number;
  reviewCount: number;
  soldCount: number;
  tags: ProductTag[];
  createdAt: string;
}

export type ProductTag = "new" | "bestseller" | "sale" | "limited";

/** A product joined with its computed, display-ready fields. */
export interface ProductSummary extends Product {
  brandName: string;
  discountPercent: number;
  inStock: boolean;
  totalStock: number;
}

/* -------------------------------------------------------------------------- */
/* Search & filtering                                                          */
/* -------------------------------------------------------------------------- */

export type SortKey =
  | "newest"
  | "bestselling"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "discount";

export interface ProductFilters {
  q?: string;
  categories?: string[];
  genders?: Gender[];
  brands?: string[];
  sizes?: number[];
  colors?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  sort?: SortKey;
  page?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* -------------------------------------------------------------------------- */
/* Cart                                                                        */
/* -------------------------------------------------------------------------- */

/** Identified by variant, so the same shoe in two sizes is two lines. */
export interface CartItem {
  productId: ID;
  variantId: ID;
  slug: string;
  name: string;
  image: string;
  colorId: ID;
  colorName: string;
  colorHex: string;
  size: number;
  /** Unit price actually charged. */
  price: number;
  compareAtPrice?: number;
  quantity: number;
  /** Snapshot of variant stock, used to cap the quantity stepper. */
  maxQuantity: number;
}

export interface Coupon {
  code: string;
  /** `percent` caps at `maxDiscount`; `fixed` subtracts `value` Tomans. */
  type: "percent" | "fixed";
  value: number;
  maxDiscount?: number;
  minSubtotal?: number;
  description: string;
  expiresAt?: string;
}

export type CouponState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "applied"; coupon: Coupon; discount: number }
  | { status: "invalid"; message: string };

export interface OrderTotals {
  subtotal: number;
  /** Savings already reflected in line prices (compareAtPrice - price). */
  productDiscount: number;
  couponDiscount: number;
  /** Charged by the courier on delivery — NOT part of `payableOnline`. */
  shippingCost: number;
  payableOnline: number;
  grandTotal: number;
}

/* -------------------------------------------------------------------------- */
/* Account, addresses, orders                                                  */
/* -------------------------------------------------------------------------- */

export interface User {
  id: ID;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  nationalId?: string;
  birthDate?: string;
  createdAt: string;
  smsNotifications: boolean;
}

export interface Address {
  id: ID;
  title: string;
  recipientFirstName: string;
  recipientLastName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  plaque?: string;
  unit?: string;
  isDefault: boolean;
}

/**
 * The five primary statuses are fixed and ordered. The exception statuses sit
 * outside the timeline and are rendered as a terminal state instead.
 */
export type OrderStatus =
  | "awaiting_payment"
  | "preparing"
  | "packaged"
  | "shipped"
  | "delivered";

export type OrderExceptionStatus =
  | "cancelled"
  | "returned"
  | "refunded"
  | "payment_failed"
  | "expired";

export type AnyOrderStatus = OrderStatus | OrderExceptionStatus;

export interface OrderItem {
  productId: ID;
  variantId: ID;
  slug: string;
  name: string;
  image: string;
  colorName: string;
  colorHex: string;
  size: number;
  quantity: number;
  unitPrice: number;
  compareAtPrice?: number;
}

export interface OrderTimelineEntry {
  status: AnyOrderStatus;
  at: string;
  note?: string;
}

/**
 * How an order was paid for.
 *
 * "online" is the ZarinPal gateway — the only one Loran uses. The rest are
 * ways a manually entered order was settled in person. A string rather than a
 * union for the same reason as `ShippingMethodId`: the set is data, not code.
 */
export type PaymentMethod = string;

export interface Order {
  id: ID;
  /** Human-facing order number, e.g. «LRN-140312-0481». */
  number: string;
  status: AnyOrderStatus;
  createdAt: string;
  items: OrderItem[];
  totals: OrderTotals;
  couponCode?: string;
  address: Address;
  shippingMethod: ShippingMethodId;
  trackingCode?: string;
  paymentMethod: PaymentMethod;
  paymentRef?: string;
  paidAt?: string;
  timeline: OrderTimelineEntry[];
  estimatedDelivery?: string;
  smsNotifications: boolean;
}

/**
 * A shipping method's stable code.
 *
 * Deliberately a string rather than a union: shipping methods live in the
 * database and an administrator can add one, so a closed union here would be a
 * lie the moment they do. "tipax", "post" and "courier" are what ships seeded.
 */
export type ShippingMethodId = string;

export interface ShippingMethod {
  id: ShippingMethodId;
  name: string;
  description: string;
  cost: number;
  /** Tipax is postpaid: the customer pays the courier, not Loran. */
  paidOnDelivery: boolean;
  estimate: string;
  available: boolean;
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                     */
/* -------------------------------------------------------------------------- */

export interface Review {
  id: ID;
  productId: ID;
  authorName: string;
  rating: number;
  title?: string;
  body: string;
  createdAt: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  /** Set when the reviewer named the variant they bought. */
  purchasedVariant?: { colorName: string; size: number };
  /** Optional structured sizing feedback — genuinely useful for shoes. */
  sizeFeedback?: "small" | "true" | "large";
}

export interface RatingBreakdown {
  average: number;
  total: number;
  /** Counts indexed 5 → 1. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  sizeFeedback: { small: number; true: number; large: number };
}

/* -------------------------------------------------------------------------- */
/* Return requests                                                             */
/* -------------------------------------------------------------------------- */

export type ReturnStatus = "requested" | "approved" | "in_transit" | "refunded" | "rejected";

export interface ReturnRequest {
  id: ID;
  orderNumber: string;
  createdAt: string;
  status: ReturnStatus;
  reason: string;
  items: { name: string; colorName: string; size: number; quantity: number }[];
  refundAmount: number;
  type: "return" | "exchange";
}
