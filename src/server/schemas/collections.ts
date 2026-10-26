import { z } from "zod";
import { slugSchema, text } from "@/server/lib/validation";

/** New collections are intentionally independent of product brands. */
export const collectionSchema = z.object({
  name: text(2, 80, "نام کالکشن را وارد کنید."),
  slug: slugSchema.optional(),
  subtitle: z.string().trim().max(500).optional(),
  image: z.string().max(500).refine(url => !url || url.startsWith("/") || /^https:\/\//.test(url), "آدرس تصویر نامعتبر است.").nullable().optional(),
  active: z.boolean().optional(),
  position: z.coerce.number().int().min(0).max(9999).optional(),
  productIds: z.array(z.string().min(1).max(100)).max(500).optional(),
});
