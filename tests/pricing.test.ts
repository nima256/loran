import { describe, expect, it } from "vitest";
import { applyDiscount, discountPercent, effectivePricing } from "@/server/services/pricing";
import type { CampaignPricing } from "@/server/services/pricing";

/**
 * The price-precedence rules.
 *
 * These are the numbers a customer is charged, so each rule from the documented
 * chain gets a test — including the ones that exist to stop a misconfiguration
 * costing money.
 */

const campaign = (over: Partial<{ type: "percent" | "fixed"; value: number; maxDiscount: number | null; priority: number }> = {}) =>
  new Map([
    ["p1", {
      id: "c1",
      name: "کمپین",
      type: over.type ?? ("percent" as const),
      value: over.value ?? 20,
      maxDiscount: over.maxDiscount ?? null,
      priority: over.priority ?? 0,
    }],
  ]) as CampaignPricing;

describe("applyDiscount", () => {
  it("applies a percentage", () => {
    expect(applyDiscount(1_000_000, "percent", 10, null)).toBe(100_000);
  });

  it("caps a percentage at maxDiscount", () => {
    expect(applyDiscount(10_000_000, "percent", 20, 400_000)).toBe(400_000);
  });

  it("applies a fixed amount", () => {
    expect(applyDiscount(1_000_000, "fixed", 250_000, null)).toBe(250_000);
  });

  it("never discounts more than the base — a free order is not a rounding error", () => {
    expect(applyDiscount(100_000, "fixed", 500_000, null)).toBe(100_000);
  });
});

describe("effectivePricing", () => {
  it("rule 1: with no campaign the catalogue price stands", () => {
    const result = effectivePricing({ id: "p1", price: 2_000_000, compareAtPrice: 2_500_000 });
    expect(result.price).toBe(2_000_000);
    expect(result.compareAtPrice).toBe(2_500_000);
    expect(result.discountPercent).toBe(20);
  });

  it("rule 2: a live campaign comes off the base price", () => {
    const result = effectivePricing({ id: "p1", price: 2_000_000, compareAtPrice: null }, campaign());
    expect(result.price).toBe(1_600_000);
    expect(result.compareAtPrice).toBe(2_000_000);
    expect(result.campaign?.id).toBe("c1");
  });

  it("rule 2: a campaign on an already-discounted product deepens the discount", () => {
    const result = effectivePricing(
      { id: "p1", price: 2_000_000, compareAtPrice: 2_500_000 },
      campaign({ value: 10 })
    );
    expect(result.price).toBe(1_800_000);
    // The struck-through figure stays the honest highest "was" price.
    expect(result.compareAtPrice).toBe(2_500_000);
  });

  it("rule 2: a campaign that would not lower the price is discarded, never applied", () => {
    const result = effectivePricing(
      { id: "p1", price: 2_000_000, compareAtPrice: null },
      campaign({ type: "fixed", value: 0 })
    );
    expect(result.price).toBe(2_000_000);
    expect(result.campaign).toBeUndefined();
  });

  it("rule 3: a variant price override wins outright and ignores campaigns", () => {
    const result = effectivePricing(
      { id: "p1", price: 2_000_000, compareAtPrice: null, variantPrice: 900_000 },
      campaign()
    );
    expect(result.price).toBe(900_000);
    expect(result.campaign).toBeUndefined();
  });

  it("a product not in the campaign map is unaffected", () => {
    const result = effectivePricing({ id: "other", price: 2_000_000, compareAtPrice: null }, campaign());
    expect(result.price).toBe(2_000_000);
  });
});

describe("discountPercent", () => {
  it("is zero when compare-at is missing or not actually higher", () => {
    expect(discountPercent(1000, null)).toBe(0);
    expect(discountPercent(1000, 1000)).toBe(0);
    expect(discountPercent(1000, 900)).toBe(0);
  });
});
