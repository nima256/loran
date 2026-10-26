import type { DiscountType } from "@prisma/client";

/**
 * The single, documented rule for how a product's price is decided.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  PRICE PRECEDENCE — applied in this order, always on the server
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  1. BASE PRICE      `product.price` is what the customer pays by default.
 *                     `product.compareAtPrice`, when set, is the struck-through
 *                     "was" price — the product is already on sale at the
 *                     catalogue level.
 *
 *  2. CAMPAIGN        A live campaign containing the product applies its
 *                     discount to the base price. If several campaigns contain
 *                     the product, the one with the highest `priority` wins;
 *                     campaigns never stack with each other.
 *                     The campaign price replaces the base price, and whatever
 *                     the pre-discount price was (compareAtPrice, else the base
 *                     price) becomes the struck-through figure — so a campaign
 *                     on an already-discounted product deepens the discount
 *                     rather than being ignored.
 *                     A campaign that would not actually lower the price is
 *                     discarded, so a badly configured campaign can never raise
 *                     what a customer pays.
 *
 *  3. UNIT PRICE      A variant may override the price of its product. The
 *                     override is taken as-is and campaigns do not apply to it,
 *                     because a per-variant price is a deliberate exception.
 *
 *  4. COUPON          Applied last, to the ORDER SUBTOTAL — never to a line.
 *                     Exactly one coupon per order. It therefore stacks with
 *                     campaign and catalogue discounts by design: the customer
 *                     gets the best item price first, then the coupon comes off
 *                     the total.
 *
 *  5. SHIPPING        Calculated after the coupon, from the shipping method's
 *                     own rules (cost, free-shipping threshold, whether the
 *                     courier collects on delivery).
 *
 * Nothing in this chain is evaluated in the browser. The storefront renders
 * what the server computed, and the checkout recomputes all of it from the
 * database before an order is created — a price posted by the client is
 * ignored outright.
 */

export interface CampaignRule {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  maxDiscount: number | null;
  priority: number;
}

/** productId → the winning live campaign for that product. */
export type CampaignPricing = Map<string, CampaignRule>;

export interface PricedInput {
  id: string;
  price: number;
  compareAtPrice: number | null;
  /** A variant-level override. When present it wins outright — see rule 3. */
  variantPrice?: number | null;
  variantCompareAtPrice?: number | null;
}

export interface PricingResult {
  /** What the customer actually pays per unit. */
  price: number;
  /** The struck-through figure, or null when there is no discount to show. */
  compareAtPrice: number | null;
  discountPercent: number;
  /** Set when a campaign decided the price, for badges and audit trails. */
  campaign?: { id: string; name: string };
}

export function discountPercent(price: number, compareAt?: number | null): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** Applies a percent/fixed rule, capped so it can never exceed the base. */
export function applyDiscount(
  base: number,
  type: DiscountType,
  value: number,
  maxDiscount: number | null
): number {
  const raw = type === "percent" ? Math.round((base * value) / 100) : value;
  const capped = maxDiscount != null ? Math.min(raw, maxDiscount) : raw;
  return Math.max(0, Math.min(capped, base));
}

/**
 * Resolves rules 1–3 for one product or variant.
 *
 * Pure and synchronous: the caller supplies the campaign map (loaded once per
 * page of results), so this never issues a query of its own.
 */
export function effectivePricing(input: PricedInput, campaigns?: CampaignPricing): PricingResult {
  // Rule 3 — a variant override is a deliberate exception and wins outright.
  if (input.variantPrice != null) {
    const compareAt = input.variantCompareAtPrice ?? null;
    return {
      price: input.variantPrice,
      compareAtPrice: compareAt,
      discountPercent: discountPercent(input.variantPrice, compareAt),
    };
  }

  const base = input.price;
  const catalogueCompareAt = input.compareAtPrice;
  const campaign = campaigns?.get(input.id);

  // Rule 1 — no live campaign, so the catalogue price stands.
  if (!campaign) {
    return {
      price: base,
      compareAtPrice: catalogueCompareAt,
      discountPercent: discountPercent(base, catalogueCompareAt),
    };
  }

  // Rule 2 — the campaign discount comes off the base price.
  const reduction = applyDiscount(base, campaign.type, campaign.value, campaign.maxDiscount);
  const campaignPrice = base - reduction;

  // A campaign that doesn't lower the price is discarded rather than applied,
  // so a misconfigured campaign can never raise what a customer pays.
  if (campaignPrice >= base) {
    return {
      price: base,
      compareAtPrice: catalogueCompareAt,
      discountPercent: discountPercent(base, catalogueCompareAt),
    };
  }

  // The struck-through figure is the highest honest "was" price: the catalogue
  // compare-at when there is one, otherwise the base price.
  const compareAt = Math.max(catalogueCompareAt ?? 0, base) || null;

  return {
    price: campaignPrice,
    compareAtPrice: compareAt,
    discountPercent: discountPercent(campaignPrice, compareAt),
    campaign: { id: campaign.id, name: campaign.name },
  };
}
