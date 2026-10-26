/**
 * Single source of truth for everything the business owner edits.
 *
 * ⚠️ PLACEHOLDERS — every value marked `TODO` is intentionally not invented.
 * Replace them with the real details before launch. Nothing else in the codebase
 * hard-codes a phone number, address or social handle.
 */

export const siteConfig = {
  name: "لوران",
  nameEn: "LORAN",
  legalName: "فروشگاه کفش لوران", // TODO: replace with the registered legal name
  domain: "loranworld.com",
  url: "https://loranworld.com",
  tagline: "کفشی که پای تو را می‌شناسد",
  description:
    "فروشگاه اینترنتی کفش لوران در یزد؛ اسنیکر، کتونی، رسمی و روزمره برای زنان و مردان با ارسال به سراسر ایران.",

  /** Shown on the contact page and in the footer. */
  contact: {
    // TODO: replace with the final published support number.
    supportPhone: "۰۹۰۱۰۸۷۷۲۷۵",
    supportPhoneRaw: "+989010877275",
    /** Live support chat — the floating button and the contact page. */
    telegramHandle: "@loranadmin",
    telegramUrl: "https://t.me/loranadmin",
    // TODO: replace with the official support email.
    email: "info@loranworld.com",
    workingHours: "پشتیبانی همه روزه",
  },

  /** From the business card. Verify and extend before launch. */
  stores: [
    {
      id: "star-ground-entrance",
      name: "شعبه پاساژ ستاره - همکف",
      address: "یزد، خیابان طالقانی، پاساژ ستاره، طبقه همکف، جنب ورودی", // TODO: verify
      phone: "۰۹۱۷۴۷۳۶۹۷۵",
      instagram: "Loran_Shoes",
      // TODO: replace with the real coordinates for the map embed.
      coords: { lat: 31.8974, lng: 54.3569 },
      mapsUrl: "", // TODO: paste the Google Maps / Neshan share link
    },
    {
      id: "star-first-floor",
      name: "شعبه پاساژ ستاره - طبقه اول",
      address: "یزد، خیابان طالقانی، پاساژ ستاره، طبقه اول، جنب پله برقی", // TODO: verify
      phone: "۰۹۱۷۵۵۸۵۷۱۳",
      instagram: "Loran_Shoes2",
      coords: { lat: 31.8974, lng: 54.3569 },
      mapsUrl: "",
    },
    {
      id: "star-ground-vid",
      name: "شعبه پاساژ ستاره - جنب وید مرکزی",
      address: "یزد، پاساژ ستاره، طبقه همکف، جنب وید مرکزی", // TODO: verify
      phone: "۰۹۱۷۵۵۸۵۷۱۳",
      instagram: "Loran_Shoes",
      coords: { lat: 31.8974, lng: 54.3569 },
      mapsUrl: "",
    },
  ],

  social: [
    { id: "instagram", label: "اینستاگرام", handle: "@Loran_Shoes", url: "https://instagram.com/Loran_Shoes" },
    { id: "instagram2", label: "اینستاگرام دوم", handle: "@Loran_Shoes2", url: "https://instagram.com/Loran_Shoes2" },
    { id: "telegram", label: "تلگرام", handle: "@loran_shoes", url: "https://t.me/loran_shoes" },
  ],

  /**
   * Free-shipping threshold and courier settings surfaced across the UI.
   *
   * `freeShippingThreshold` is what the announcement bar and the cart promise.
   * The amount the checkout actually applies is each shipping method's own
   * `freeShippingThreshold` in the database (admin → settings), which the
   * 20261018120000 migration sets to this same figure. Change both together.
   */
  commerce: {
    currency: "تومان",
    freeShippingThreshold: 8_000_000,
    /** Tipax is postpaid — collected by the courier, not by Loran online. */
    shippingNoticeShort: "در صورت انتخاب تیپاکس، کرایه هنگام تحویل مرسوله پرداخت می‌شود.",
    /**
     * Exchange-only policy (no returns/refunds): exchanges can be requested
     * within this many business days (Saturday–Thursday) of delivery. See
     * src/lib/exchange-policy.ts.
     */
    exchangeWindowBusinessDays: 2,
    productsPerPage: 24,
  },
} as const;

export type SiteConfig = typeof siteConfig;
