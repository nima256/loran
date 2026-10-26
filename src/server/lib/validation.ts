import { z } from "zod";
import {
  normalizeIranMobile,
  normalizePersian,
  normalizePostalCode,
  toLatinDigits,
} from "@/lib/persian";

/**
 * Validation primitives shared by every route.
 *
 * Persian input is normalised *inside* the schema, so a handler that receives a
 * parsed value is holding the canonical form already — there is no second place
 * where a phone number could be stored unnormalised.
 */

export const phoneSchema = z
  .string()
  .transform((v) => normalizeIranMobile(v))
  .refine((v) => v !== "", { message: "شماره موبایل معتبر نیست." });

export const otpCodeSchema = z
  .string()
  .transform((v) => toLatinDigits(v).replace(/\D/g, ""))
  .refine((v) => /^\d{5}$/.test(v), { message: "کد تأیید باید ۵ رقم باشد." });

export const postalCodeSchema = z
  .string()
  .transform((v) => normalizePostalCode(v))
  .refine((v) => v !== "", { message: "کد پستی باید ۱۰ رقم باشد." });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: "ایمیل معتبر نیست." });

export const optionalEmailSchema = z
  .union([emailSchema, z.literal("")])
  .optional()
  .transform((v) => (v ? v : undefined));

/** Free text with a length cap, trimmed. Rejects whitespace-only input. */
export const text = (min: number, max: number, message?: string) =>
  z
    .string()
    .trim()
    .min(min, { message: message ?? `حداقل ${min} کاراکتر لازم است.` })
    .max(max, { message: `حداکثر ${max} کاراکتر مجاز است.` });

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `حداکثر ${max} کاراکتر مجاز است.` })
    .optional()
    .transform((v) => (v ? v : undefined));

/** Money: a non-negative integer number of Tomans. */
export const tomanSchema = z.coerce
  .number()
  .int({ message: "مبلغ باید عدد صحیح باشد." })
  .min(0, { message: "مبلغ نمی‌تواند منفی باشد." })
  .max(100_000_000_000);

export const quantitySchema = z.coerce.number().int().min(1).max(20);

export const cuidSchema = z.string().min(1).max(64);

/** A URL-safe slug. Persian letters are allowed and kept. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[\p{L}\p{N}-]+$/u, { message: "نشانی (slug) فقط می‌تواند شامل حروف، عدد و خط تیره باشد." });

/** Normalised free text used for search queries. */
export const searchQuerySchema = z
  .string()
  .max(120)
  .transform((v) => normalizePersian(v));

/** Shared server-side list controls for the admin tables. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function paginationArgs({ page, pageSize }: Pagination) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(items: T[], total: number, { page, pageSize }: Pagination) {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
