import { z } from "zod";
import { handler, ok, readJson } from "@/server/lib/http";
import { requireCustomer } from "@/server/lib/session";
import { getProfile, updateProfile } from "@/server/services/customers";
import { optionalEmailSchema, optionalText, text } from "@/server/lib/validation";
import { toLatinDigits } from "@/lib/persian";

/** GET / PATCH /api/v1/account/profile */

const patchSchema = z.object({
  firstName: text(2, 60, "نام را وارد کنید.").optional(),
  lastName: text(2, 60, "نام خانوادگی را وارد کنید.").optional(),
  email: optionalEmailSchema,
  nationalId: z
    .string()
    .transform((v) => toLatinDigits(v).replace(/\D/g, ""))
    .refine((v) => v === "" || /^\d{10}$/.test(v), { message: "کد ملی باید ۱۰ رقم باشد." })
    .optional(),
  birthDate: optionalText(30),
  smsNotifications: z.boolean().optional(),
});

export const GET = handler(async () => {
  const customer = await requireCustomer();
  return ok({ user: await getProfile(customer.id) });
});

export const PATCH = handler(async (request) => {
  const customer = await requireCustomer();
  const input = await readJson(request, patchSchema);
  return ok({ user: await updateProfile(customer.id, input) });
});
