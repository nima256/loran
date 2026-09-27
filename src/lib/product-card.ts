import type { ProductSummary, ProductTag } from "@/types";

/**
 * Minimal product shape needed by ProductCard.
 *
 * Product list queries return the full ProductSummary because detail/search
 * pages need it, but serialising that entire object into a client component on
 * the homepage sends descriptions, specs and unused gallery/variant fields to
 * the browser. This compact shape keeps the card UI identical while reducing
 * the RSC payload substantially.
 */
export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  price: number;
  compareAtPrice?: number;
  colors: {
    id: string;
    name: string;
    hex: string;
    images: string[];
  }[];
  /** Original colour count, because compact cards keep at most five colours. */
  colorCount?: number;
  variants: {
    colorId: string;
    stock: number;
  }[];
  rating: number;
  reviewCount: number;
  tags: ProductTag[];
  discountPercent: number;
  inStock: boolean;
}

export function toProductCardData(product: ProductSummary): ProductCardData {
  const colors = product.colors.slice(0, 5).map((color) => ({
    id: color.id,
    name: color.name,
    hex: color.hex,
    // The card only ever displays the main image + the optional hover image.
    images: color.images.slice(0, 2),
  }));
  const colorIds = new Set(colors.map((color) => color.id));

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brandName: product.brandName,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    colors,
    colorCount: product.colors.length,
    variants: product.variants
      .filter((variant) => colorIds.has(variant.colorId))
      .map((variant) => ({ colorId: variant.colorId, stock: variant.stock })),
    rating: product.rating,
    reviewCount: product.reviewCount,
    tags: product.tags,
    discountPercent: product.discountPercent,
    inStock: product.inStock,
  };
}
