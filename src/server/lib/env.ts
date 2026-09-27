import "server-only";
import { z } from "zod";

/**
 * Server environment.
 *
 * Parsed once, at first import, so a misconfigured production deployment fails
 * loudly at boot instead of at the first checkout. Nothing here is ever read
 * from client code — the `server-only` import above enforces that at build time.
 */

const bool = (fallback: "true" | "false" = "false") =>
  z
    .enum(["true", "false", "1", "0", ""])
    .default(fallback)
    .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL الزامی است"),

  /** Public origin, used to build gateway callback URLs. No trailing slash. */
  SITE_URL: z
    .string()
    .default("http://localhost:3000")
    .transform((v) => v.replace(/\/+$/, "")),

  /** Keys session tokens. Rotating it signs every session out. */
  SESSION_SECRET: z.string().min(1),
  /** Keys the OTP HMAC. Separate from SESSION_SECRET on purpose. */
  OTP_SECRET: z.string().min(1),

  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),

  OTP_EXPIRES_SECONDS: z.coerce.number().int().positive().default(120),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  /** Skips the SMS provider and returns the code in the response. Dev only. */
  OTP_MOCK: bool("false"),

  MELIPAYAMAK_SHARED_KEY: z.string().default(""),
  MELIPAYAMAK_OTP_BODY_ID: z.string().default(""),
  MELIPAYAMAK_ORDER_BODY_ID: z.string().default(""),
  MELIPAYAMAK_SHIPPED_BODY_ID: z.string().default(""),

  PAYMENT_MOCK: bool("false"),
  ZARINPAL_MERCHANT_ID: z.string().default(""),
  ZARINPAL_SANDBOX: bool("false"),
  ZARINPAL_AMOUNT_UNIT: z.enum(["toman", "rial"]).default("toman"),

  ADMIN_EMAIL: z.string().email().optional().or(z.literal("")).default(""),
  ADMIN_PASSWORD: z.string().default(""),

  /** Where product images land. A bind-mounted volume in production. */
  UPLOAD_DIR: z.string().default("./public/uploads"),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  /** Prefix the storefront renders images under. */
  UPLOAD_PUBLIC_PREFIX: z.string().default("/uploads"),

  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  TRUST_PROXY: bool("false"),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
    throw new Error(`پیکربندی محیط نامعتبر است:\n  ${issues}`);
  }
  const value = parsed.data;
  const isProduction = value.NODE_ENV === "production";

  // `next build` runs with NODE_ENV=production but on a build machine that has
  // no reason to hold production secrets — a CI runner, or the operator's
  // laptop. Enforcing the production requirements there would make the app
  // impossible to build without handing the builder the live credentials. The
  // checks below therefore run when the server actually *starts*, which is the
  // moment that matters.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  // `npm run preview` is a production-build preview intended ONLY for the local
  // machine (for Lighthouse / profiling). Keep the real `npm start` strict.
  // Even if this flag is accidentally set on a deployed server, the bypass is
  // refused unless SITE_URL points to localhost/127.0.0.1.
  const localPreviewRequested = process.env.LORAN_LOCAL_PREVIEW === "1";
  const isLocalSite = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(value.SITE_URL);
  const isLocalProductionPreview = localPreviewRequested && isLocalSite;

  if (isProduction && !isBuildPhase && !isLocalProductionPreview) {
    const missing: string[] = [];
    if (value.SESSION_SECRET.length < 32) missing.push("SESSION_SECRET (حداقل ۳۲ کاراکتر)");
    if (value.OTP_SECRET.length < 32) missing.push("OTP_SECRET (حداقل ۳۲ کاراکتر)");
    if (!/^https:\/\//i.test(value.SITE_URL)) missing.push("SITE_URL با HTTPS");
    if (value.OTP_MOCK) missing.push("OTP_MOCK باید در production غیرفعال باشد");
    if (!value.OTP_MOCK && !value.MELIPAYAMAK_SHARED_KEY) missing.push("MELIPAYAMAK_SHARED_KEY");
    if (!value.OTP_MOCK && !value.MELIPAYAMAK_OTP_BODY_ID) missing.push("MELIPAYAMAK_OTP_BODY_ID");
    if (value.PAYMENT_MOCK) missing.push("PAYMENT_MOCK باید در production غیرفعال باشد");
    if (!value.PAYMENT_MOCK && !value.ZARINPAL_MERCHANT_ID) missing.push("ZARINPAL_MERCHANT_ID");
    if (missing.length) {
      throw new Error(`تنظیمات ضروری محیط production ناقص است:\n  ${missing.join("\n  ")}`);
    }
  }

  return { ...value, isProduction, isDevelopment: value.NODE_ENV === "development" };
}

export const env = load();
export type Env = typeof env;
