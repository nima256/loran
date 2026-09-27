import { z } from "zod";
import { cuidSchema, optionalText, quantitySchema } from "../lib/validation";

/**
 * Checkout request shapes.
 *
 * Note what is *absent*: no price, no subtotal, no discount amount. The client
 * says which variants and how many, and which address and shipping method it
 * picked. Every figure is computed server-side from the database.
 */

export const cartLineSchema = z.object({
  variantId: cuidSchema,
  quantity: quantitySchema,
  /**
   * The unit price the browser last displayed. Used only to detect that the
   * price moved so the customer can be warned — never to decide a charge.
   */
  displayedPrice: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
});

export const validateCartSchema = z.object({
  items: z.array(cartLineSchema).max(50),
  couponCode: optionalText(40),
  shippingMethodCode: optionalText(40),
});

export const checkoutSchema = z.object({
  items: z.array(cartLineSchema).min(1, { message: "سبد خرید خالی است." }).max(50),
  addressId: cuidSchema,
  shippingMethodCode: optionalText(40),
  couponCode: optionalText(40),
  note: optionalText(500),
  /** Only "online" exists today; ZarinPal is the single gateway. */
  paymentMethod: z.literal("online").default("online"),
});

export type ValidateCartPayload = z.infer<typeof validateCartSchema>;
export type CheckoutPayload = z.infer<typeof checkoutSchema>;
