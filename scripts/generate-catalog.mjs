/**
 * Generates the mock catalog at `src/data/catalog.json`.
 *
 * Deterministic (seeded) so the same product list appears on every machine and
 * every build — no hydration mismatches, no "why did my screenshot change".
 *
 * ▶ When the backend lands, delete this script and `catalog.json`; `src/data/*.ts`
 *   keeps the same exported shape, so only its internals change.
 *
 *   node scripts/generate-catalog.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/* --- deterministic PRNG (mulberry32) ------------------------------------- */
let seed = 0x9a1c21;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pickN = (arr, n) => {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) out.push(...copy.splice(Math.floor(rnd() * copy.length), 1));
  return out;
};
const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
/** Persian digits — the storefront never mixes numeral systems in copy. */
const fa = (value) => String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
const chance = (p) => rnd() < p;
/** Round to a price shape Iranian shops actually use (…۹۰۰٬۰۰۰ / …۵۰۰٬۰۰۰). */
const roundPrice = (n) => Math.round(n / 50_000) * 50_000;

/* --- taxonomy ------------------------------------------------------------ */
const categories = [
  { id: "c-sneaker", slug: "sneaker",  name: "کتانی و اسنیکر",   description: "اسنیکرهای روزمره برای استایل خیابانی و راحتی تمام‌روز.", featured: true,  shapes: ["sneaker", "hightop"] },
  { id: "c-running", slug: "running",  name: "ورزشی و رانینگ",   description: "کفش‌های سبک با زیره کوشن‌دار برای دویدن و تمرین روزانه.", featured: true,  shapes: ["runner"] },
  { id: "c-casual",  slug: "casual",   name: "روزمره و کژوال",   description: "کفش‌های راحت برای دانشگاه، بیرون رفتن و روزهای معمولی.", featured: true,  shapes: ["sneaker", "loafer"] },
  { id: "c-classic", slug: "classic",  name: "رسمی و کلاسیک",    description: "کفش‌های چرمی رسمی برای مهمانی، محل کار و مناسبت‌ها.", featured: true,  shapes: ["loafer"] },
  { id: "c-boots",   slug: "boots",    name: "بوت و نیم‌بوت",    description: "بوت و نیم‌بوت مقاوم برای پاییز و زمستان.", featured: true,  shapes: ["boot"] },
  { id: "c-loafer",  slug: "loafer",   name: "کالج و لوفر",      description: "کالج و لوفرهای بدون بند با فرم جمع و شیک.", featured: true,  shapes: ["loafer"] },
  { id: "c-sandal",  slug: "sandal",   name: "صندل و تابستانی",  description: "صندل و کفش‌های سبک تابستانی.", featured: true,  shapes: ["sandal"] },
  { id: "c-kids",    slug: "kids",     name: "بچگانه",           description: "کفش‌های سبک و بادوام برای بچه‌ها.", featured: true,  shapes: ["sneaker", "runner"] },
];

/**
 * Loran's own product lines. The storefront is a single-brand boutique, so
 * "brand" here means the in-house collection. Swap these for real vendor names
 * if the shop starts carrying third-party labels.
 */
const brands = [
  { id: "b-urban",   slug: "loran-urban",   name: "لوران اربن" },
  { id: "b-sport",   slug: "loran-sport",   name: "لوران اسپرت" },
  { id: "b-classic", slug: "loran-classic", name: "لوران کلاسیک" },
  { id: "b-street",  slug: "loran-street",  name: "لوران استریت" },
  { id: "b-daily",   slug: "loran-daily",   name: "لوران دیلی" },
];

const COLORS = {
  black:    { name: "مشکی",        hex: "#1A1A1C" },
  white:    { name: "سفید",        hex: "#F2F1EE" },
  cream:    { name: "کرم",         hex: "#E7DCC9" },
  burgundy: { name: "زرشکی",       hex: "#9A1C21" },
  navy:     { name: "سرمه‌ای",     hex: "#1F2E4A" },
  grey:     { name: "طوسی",        hex: "#7E7B78" },
  tan:      { name: "عسلی",        hex: "#9C6B3E" },
  olive:    { name: "زیتونی",      hex: "#54603C" },
  skyblue:  { name: "آبی روشن",    hex: "#6FA3C9" },
  brown:    { name: "قهوه‌ای",     hex: "#4E3527" },
  blush:    { name: "صورتی کهنه",  hex: "#C99A94" },
  silver:   { name: "نقره‌ای",     hex: "#B9B7B2" },
};

/**
 * Model names carry an explicit Latin form.
 *
 * Slugs stay ASCII on purpose: a Persian slug becomes an unreadable
 * percent-encoded string the moment it is shared, logged or passed to an API,
 * and it is a recurring source of double-encoding bugs. The Persian name still
 * appears in the product title, the <h1> and the page metadata.
 */
const MODEL_NAMES = [
  ["اربن", "urban"], ["مونو", "mono"], ["ترِیل", "trail"], ["ونیز", "venice"],
  ["آریا", "aria"], ["کویر", "kavir"], ["نسیم", "nasim"], ["رترو", "retro"],
  ["یلدا", "yalda"], ["مهتاب", "mahtab"], ["البرز", "alborz"], ["دنا", "dena"],
  ["زاگرس", "zagros"], ["کاسپین", "caspian"], ["ماهور", "mahoor"], ["نارون", "naroon"],
  ["آوا", "ava"], ["ترمه", "termeh"], ["سپهر", "sepehr"], ["رها", "raha"],
  ["بیستون", "bisotoon"], ["سیمرغ", "simorgh"], ["آرتا", "arta"], ["کارون", "karoon"],
  ["ارس", "aras"], ["دماوند", "damavand"], ["شیدا", "shida"], ["رامش", "ramesh"],
  ["پویا", "pouya"], ["نیکا", "nika"], ["برنا", "borna"], ["هیوا", "hiva"],
  ["کیان", "kian"], ["آرام", "aram"], ["ساحل", "sahel"], ["شبدیز", "shabdiz"],
  ["مروارید", "morvarid"], ["خورشید", "khorshid"], ["تندیس", "tandis"], ["پرنیان", "parnian"],
];

const TYPE_BY_SHAPE = {
  sneaker: ["کتانی", "اسنیکر"],
  hightop: ["کتانی ساق‌بلند", "اسنیکر ساق‌دار"],
  runner:  ["کفش ورزشی", "کفش رانینگ", "کفش پیاده‌روی"],
  boot:    ["نیم‌بوت", "بوت"],
  loafer:  ["کفش کلاسیک", "کالج", "لوفر"],
  sandal:  ["صندل", "کفش تابستانی"],
};

const GENDER_LABEL = { men: "مردانه", women: "زنانه", unisex: "یونیسکس", kids: "بچگانه" };

const UPPER_MATERIALS = ["چرم طبیعی", "چرم صنعتی درجه‌یک", "جیر", "کتان (کانواس)", "مش تنفسی", "ترکیب چرم و مش"];
const SOLE_MATERIALS = ["فوم EVA", "لاستیک فشرده", "پی‌یو سبک", "لاستیک ترمو", "فوم کوشن‌دار"];
const CLOSURES = ["بنددار", "بدون بند", "چسبی", "بنددار با زیپ جانبی"];

const FEATURE_POOL = [
  "کفی طبی و قابل جداشدن",
  "زیره ضد لغزش برای سطوح خیس",
  "وزن سبک، مناسب استفاده طولانی‌مدت",
  "آستر تنفسی برای کاهش تعریق",
  "دوخت تقویت‌شده در نقاط پرفشار",
  "پاشنه کوشن‌دار برای کاهش فشار مفصل",
  "قابلیت شست‌وشوی سطحی",
  "فرم ارگونومیک متناسب با قوس کف پا",
  "پنجه پهن، مناسب پاهای عریض",
  "مقاوم در برابر سایش روزمره",
];

const DESC_OPENERS = [
  "طراحی این مدل بر پایه فرم کلاسیک و جزئیات امروزی شکل گرفته است.",
  "یک انتخاب مطمئن برای کسانی که راحتی را فدای استایل نمی‌کنند.",
  "ترکیب متعادلی از سادگی، دوام و ظاهری که به‌راحتی با هر ست لباسی هماهنگ می‌شود.",
  "فرم جمع و خطوط تمیز این مدل، آن را به گزینه‌ای همیشگی در کمد کفش تبدیل می‌کند.",
  "برای استفاده روزمره ساخته شده؛ از مسیر دانشگاه تا قدم‌زدن‌های عصرگاهی.",
];
const DESC_BODY = [
  "رویه با دقت انتخاب شده تا در طول زمان فرم خود را حفظ کند و زیره سبک، خستگی پا را در ساعات طولانی کاهش می‌دهد.",
  "زیره انعطاف‌پذیر همراه با کفی نرم، حس راحتی را از همان بار اول پوشیدن منتقل می‌کند.",
  "جزئیات دوخت و پرداخت لبه‌ها با وسواس انجام شده تا ظاهر کفش پس از چند ماه استفاده هم مرتب بماند.",
];
const DESC_CLOSERS = [
  "پیش از سفارش، راهنمای سایز را ببینید تا انتخاب دقیق‌تری داشته باشید.",
  "در صورت تردید بین دو سایز، سایز بزرگ‌تر را انتخاب کنید.",
  "این مدل در چند رنگ‌بندی موجود است و تعداد هر سایز محدود است.",
];

const sizeRangeFor = (gender) => {
  if (gender === "kids") return [28, 29, 30, 31, 32, 33, 34, 35];
  if (gender === "women") return [36, 37, 38, 39, 40, 41];
  if (gender === "men") return [39, 40, 41, 42, 43, 44, 45, 46];
  return [37, 38, 39, 40, 41, 42, 43, 44];
};

const PRODUCT_COUNT = 100;
const products = [];
const usedSlugs = new Set();

for (let i = 0; i < PRODUCT_COUNT; i++) {
  const category = categories[i % categories.length];
  const shape = pick(category.shapes);
  const gender =
    category.id === "c-kids" ? "kids"
    : category.id === "c-classic" ? pick(["men", "men", "women"])
    : pick(["men", "women", "unisex", "men", "women"]);

  const [model, modelLatin] = pick(MODEL_NAMES);
  const type = pick(TYPE_BY_SHAPE[shape]);
  const code = int(100, 899);
  const name = `${type} ${GENDER_LABEL[gender]} لوران مدل ${model} ${fa(code)}`;

  let slug = `loran-${modelLatin}-${code}`;
  while (usedSlugs.has(slug)) slug = `${slug}-${int(2, 9)}`;
  usedSlugs.add(slug);

  // Colourways: 1–4 per product, each with its own gallery.
  const colorKeys = pickN(Object.keys(COLORS), int(2, 4));
  const colors = colorKeys.map((key) => ({
    id: `col-${key}`,
    name: COLORS[key].name,
    hex: COLORS[key].hex,
    images: [
      `/products/${shape}-${key}-side.svg`,
      `/products/${shape}-${key}-angle.svg`,
      `/products/${shape}-${key}-pair.svg`,
      `/products/${shape}-${key}-detail.svg`,
    ],
  }));

  const base =
    category.id === "c-classic" ? int(1_900_000, 4_200_000)
    : category.id === "c-boots" ? int(2_100_000, 4_800_000)
    : category.id === "c-kids" ? int(690_000, 1_600_000)
    : category.id === "c-sandal" ? int(590_000, 1_400_000)
    : int(1_200_000, 3_600_000);
  const price = roundPrice(base);

  const onSale = chance(0.32);
  const compareAtPrice = onSale ? roundPrice(price / (1 - int(10, 45) / 100)) : undefined;

  // Stock is per (colour × size) — this is the whole point of the variant model.
  const sizes = sizeRangeFor(gender);
  const variants = [];
  for (const color of colors) {
    for (const size of sizes) {
      // Mid sizes sell through less often than the extremes.
      const mid = size >= sizes[1] && size <= sizes[sizes.length - 2];
      const soldOut = chance(mid ? 0.16 : 0.42);
      variants.push({
        id: `${slug}-${color.id}-${size}`,
        sku: `LRN-${String(i + 1).padStart(3, "0")}-${color.id.slice(4, 7).toUpperCase()}-${size}`,
        colorId: color.id,
        size,
        stock: soldOut ? 0 : int(1, 14),
      });
    }
  }

  const tags = [];
  if (onSale) tags.push("sale");
  if (i % 7 === 0) tags.push("bestseller");
  if (i % 11 === 0) tags.push("new");
  if (i % 17 === 0) tags.push("limited");

  const daysAgo = int(1, 420);
  products.push({
    id: `p-${String(i + 1).padStart(3, "0")}`,
    slug,
    name,
    subtitle: `${pick(UPPER_MATERIALS)}، ${pick(CLOSURES)}`,
    brandId: pick(brands).id,
    categoryIds: [category.id],
    gender,
    price,
    compareAtPrice,
    colors,
    variants,
    description: `${pick(DESC_OPENERS)} ${pick(DESC_BODY)} ${pick(DESC_CLOSERS)}`,
    features: pickN(FEATURE_POOL, int(3, 5)),
    specs: [
      { label: "جنس رویه", value: pick(UPPER_MATERIALS) },
      { label: "جنس زیره", value: pick(SOLE_MATERIALS) },
      { label: "نوع بست", value: pick(CLOSURES) },
      { label: "کاربری", value: category.name },
      { label: "ارتفاع ساق", value: shape === "boot" || shape === "hightop" ? "ساق‌بلند" : "کوتاه" },
      { label: "فرم پنجه", value: pick(["گرد", "بادامی", "پهن"]) },
      { label: "کشور طراحی", value: "ایران" },
    ],
    rating: +(3.4 + rnd() * 1.6).toFixed(1),
    reviewCount: int(0, 148),
    soldCount: int(3, 940),
    tags,
    createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  });
}

/* --- reviews ------------------------------------------------------------- */
const REVIEWER_NAMES = [
  "سارا محمدی", "امیرحسین رضایی", "نگار کاظمی", "مهدی قاسمی", "فاطمه حیدری", "علی شریفی",
  "زهرا موسوی", "رضا نجفی", "الهام صادقی", "محمد کریمی", "پریسا احمدی", "حسین عباسی",
  "مریم توکلی", "سعید جعفری", "نیلوفر رستمی", "آرش بهرامی", "شیما یزدانی", "پویا امیری",
];
const REVIEW_TITLES = [
  "دقیقاً همون چیزی که می‌خواستم", "کیفیت خوب، ارزش خرید بالا", "راحت و سبک",
  "سایزش یک شماره کوچیکه", "بسته‌بندی و ارسال عالی", "برای استفاده روزمره عالیه",
  "رنگش با عکس فرق داشت", "بعد از دو ماه هنوز مثل روز اوله",
];
const REVIEW_BODIES = [
  "سفارشم دو روزه رسید. کیفیت دوخت واقعاً خوبه و کفی نرمی داره. کل روز پامه و اذیت نمی‌شم.",
  "رنگ زرشکی‌اش خیلی شیک‌تر از عکسه. فقط کاش سایزبندی دقیق‌تر توضیح داده می‌شد.",
  "برای پیاده‌روی طولانی خریدم و راضی‌ام. زیره‌اش سفته ولی بعد از چند روز جا باز می‌کنه.",
  "قیمتش نسبت به کیفیتی که داره منطقیه. به دوستام هم معرفی کردم.",
  "من معمولاً ۴۲ می‌پوشم، ۴۳ گرفتم و اندازه شد. پیشنهاد می‌کنم یک سایز بالاتر بگیرید.",
  "ظاهرش خیلی تمیزه و با شلوار جین و کتان هر دو ست می‌شه. از خریدم راضی‌ام.",
  "ارسال سریع بود ولی جعبه کمی آسیب دیده بود. خود کفش سالم بود.",
  "سبکه و پاشنه‌اش فشار نمیاره. برای کسی که زیاد سرپاست پیشنهاد می‌کنم.",
];

const reviews = [];
for (const product of products) {
  const count = Math.min(product.reviewCount, int(0, 9));
  for (let r = 0; r < count; r++) {
    const variant = pick(product.variants);
    const color = product.colors.find((c) => c.id === variant.colorId);
    reviews.push({
      id: `rev-${product.id}-${r}`,
      productId: product.id,
      authorName: pick(REVIEWER_NAMES),
      rating: chance(0.72) ? int(4, 5) : int(2, 4),
      title: chance(0.7) ? pick(REVIEW_TITLES) : undefined,
      body: pick(REVIEW_BODIES),
      createdAt: new Date(Date.now() - int(1, 300) * 86_400_000).toISOString(),
      verifiedPurchase: chance(0.78),
      helpfulCount: int(0, 34),
      purchasedVariant: { colorName: color.name, size: variant.size },
      sizeFeedback: pick(["small", "true", "true", "true", "large"]),
    });
  }
}

mkdirSync(join(process.cwd(), "src", "data"), { recursive: true });
writeFileSync(
  join(process.cwd(), "src", "data", "catalog.json"),
  JSON.stringify({ categories: categories.map(({ shapes, ...c }) => c), brands, products, reviews }, null, 0),
  "utf8"
);
console.log(`catalog: ${products.length} products, ${products.reduce((n, p) => n + p.variants.length, 0)} variants, ${reviews.length} reviews`);
