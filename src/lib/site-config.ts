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
    "فروشگاه اینترنتی کفش لوران در یزد؛ اسنیکر، کتانی، رسمی و روزمره برای زنان و مردان با ارسال به سراسر ایران.",

  /** Shown on the contact page and in the footer. */
  contact: {
    // TODO: replace with the final published support number.
    supportPhone: "۰۹۱۷۴۷۳۶۹۷۵",
    supportPhoneRaw: "+989174736975",
    // TODO: confirm the WhatsApp business number (may differ from support).
    whatsapp: "+989174736975",
    // TODO: replace with the official support email.
    email: "info@loranworld.com",
    workingHours: "شنبه تا پنجشنبه، ۱۰:۰۰ تا ۲۲:۰۰",
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
    { id: "telegram", label: "تلگرام", handle: "", url: "" }, // TODO
    { id: "whatsapp", label: "واتس‌اپ", handle: "", url: "" }, // TODO
  ],

  /** Free-shipping threshold and courier settings surfaced across the UI. */
  commerce: {
    currency: "تومان",
    freeShippingThreshold: 3_500_000,
    /** Tipax is postpaid — collected by the courier, not by Loran online. */
    shippingNoticeShort: "هزینه ارسال هنگام تحویل، نزد پیک تیپاکس پرداخت می‌شود.",
    returnWindowDays: 7,
    productsPerPage: 24,
  },
} as const;

export type SiteConfig = typeof siteConfig;
