import { z } from "zod";
import { optionalText, phoneSchema, postalCodeSchema, text } from "../lib/validation";

/**
 * Request schemas shared between routes.
 *
 * They live here rather than in a route file because Next.js only permits HTTP
 * method exports from a `route.ts`.
 */

export const addressSchema = z.object({
  title: text(1, 40, "عنوان آدرس را وارد کنید."),
  recipientFirstName: text(2, 60, "نام گیرنده را وارد کنید."),
  recipientLastName: text(2, 60, "نام خانوادگی گیرنده را وارد کنید."),
  phone: phoneSchema,
  province: text(2, 60, "استان را انتخاب کنید."),
  city: text(2, 60, "شهر را انتخاب کنید."),
  addressLine: text(10, 300, "نشانی کامل پستی را وارد کنید."),
  postalCode: postalCodeSchema,
  plaque: optionalText(10),
  unit: optionalText(10),
  isDefault: z.boolean().optional(),
});

export type AddressPayload = z.infer<typeof addressSchema>;
