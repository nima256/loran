import { productSchema } from "@/server/schemas/admin";

/** The database enum retains historical values for safe old-record reads. */
export const supportedProductSchema = productSchema.refine(
  input => input.gender === "men" || input.gender === "women",
  { path: ["gender"], message: "فقط جنسیت مردانه یا زنانه قابل انتخاب است." },
);
