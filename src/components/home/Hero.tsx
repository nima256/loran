"use client";

import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { HangingShoe } from "./HangingShoe";
import { cn } from "@/lib/utils";

/**
 * Homepage hero.
 *
 * Built as a slider so future campaigns can be added by appending to `SLIDES`,
 * but it never auto-advances: an auto-rotating carousel would need pause
 * controls and would move content under the user's thumb for no benefit here.
 * The first slide is deliberately the plainest — one shoe, one sentence, one CTA.
 */
interface Slide {
  id: string;
  eyebrow: string;
  title: string;
  highlight: string;
  body: string;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
  theme: "cream" | "burgundy";
}

const SLIDES: Slide[] = [
  {
    id: "main",
    eyebrow: "مجموعه جدید لوران",
    title: "کفشی که",
    highlight: "پای تو را می‌شناسد",
    body: "از اسنیکر روزمره تا کلاسیک چرم؛ انتخابی که تا آخر روز همراهت می‌ماند.",
    cta: { label: "شروع خرید", href: "/shop" },
    secondary: { label: "دیدن تخفیف‌ها", href: "/sale" },
    theme: "cream",
  },
  {
    id: "sale",
    eyebrow: "تا ۴۵٪ تخفیف",
    title: "حراج فصل",
    highlight: "هنوز ادامه دارد",
    body: "روی مدل‌های منتخب پاییز، با موجودی محدود در هر سایز.",
    cta: { label: "دیدن محصولات حراج", href: "/sale" },
    secondary: { label: "پرفروش‌ترین‌ها", href: "/shop?sort=bestselling" },
    theme: "burgundy",
  },
  {
    id: "classic",
    eyebrow: "کالکشن کلاسیک",
    title: "برای روزهایی که",
    highlight: "باید رسمی باشی",
    body: "چرم طبیعی، دوخت تقویت‌شده و فرمی که سال‌ها از مد نمی‌افتد.",
    cta: { label: "دیدن کالکشن کلاسیک", href: "/category/classic" },
    theme: "cream",
  },
];

export function Hero() {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const onBurgundy = slide.theme === "burgundy";

  const go = (next: number) => setIndex((next + SLIDES.length) % SLIDES.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="کمپین‌های لوران"
      className={cn(
        "relative overflow-hidden transition-colors duration-[--dur-slow]",
        onBurgundy ? "bg-primary" : "bg-surface-3 dark:bg-surface-2"
      )}
    >
      <div aria-hidden className={cn("brand-grid absolute inset-0", onBurgundy ? "opacity-20" : "opacity-[0.55]")} />

      <div className="container-page relative">
        <div className="grid items-center gap-6 py-8 sm:py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-12">
          {/* Copy */}
          <div key={slide.id} className="animate-slide-up order-2 max-w-xl lg:order-1">
            <p className={cn("text-sm font-semibold", onBurgundy ? "text-primary-fg/80" : "text-primary dark:text-[color:var(--primary-soft-fg)]")}>
              {slide.eyebrow}
            </p>
            <h1 className={cn("mt-3 text-3xl font-bold leading-[1.35] sm:text-4xl lg:text-5xl", onBurgundy ? "text-primary-fg" : "text-fg")}>
              {slide.title}{" "}
              <span className={cn(onBurgundy ? "text-brand-cream" : "text-primary dark:text-[color:var(--primary-soft-fg)]")}>
                {slide.highlight}
              </span>
            </h1>
            <p className={cn("mt-4 max-w-md text-base leading-8", onBurgundy ? "text-primary-fg/85" : "text-fg-muted")}>
              {slide.body}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <ButtonLink
                href={slide.cta.href}
                size="lg"
                variant={onBurgundy ? "subtle" : "primary"}
                iconEnd={<ArrowLeft className="size-4" aria-hidden />}
                className={onBurgundy ? "bg-brand-cream text-primary hover:bg-white" : undefined}
              >
                {slide.cta.label}
              </ButtonLink>
              {slide.secondary && (
                <ButtonLink
                  href={slide.secondary.href}
                  size="lg"
                  variant="secondary"
                  className={onBurgundy ? "border-primary-fg/35 bg-transparent text-primary-fg hover:bg-white/10" : undefined}
                >
                  {slide.secondary.label}
                </ButtonLink>
              )}
            </div>
          </div>

          {/* The shoe — the subject of the composition. */}
          <div className="relative order-1 flex justify-center lg:order-2 lg:justify-start">
            <HangingShoe
              className="h-[17rem] w-auto -my-4 sm:h-[21rem] lg:h-[27rem] lg:-my-6"
              body={onBurgundy ? "#EEE6DD" : "var(--hero-body)"}
              accent={onBurgundy ? "#D8CCBE" : "var(--hero-accent)"}
              sole={onBurgundy ? "#7C1418" : "var(--hero-sole)"}
              lace={onBurgundy ? "#F6EFE7" : "var(--hero-lace)"}
              shadow="#2B1A17"
            />
          </div>
        </div>

        {/* Slider controls */}
        <div className="relative flex items-center justify-between gap-4 pb-5">
          <div className="flex items-center gap-2" role="tablist" aria-label="انتخاب کمپین">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                role="tab"
                type="button"
                aria-selected={i === index}
                aria-label={`اسلاید ${i + 1}: ${s.eyebrow}`}
                onClick={() => setIndex(i)}
                // Full-height hit area; only the inner bar is drawn.
                className="grid h-11 place-items-center px-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "block h-2 rounded-full transition-[width,background-color] duration-[--dur-base]",
                    i === index ? "w-8" : "w-2",
                    onBurgundy
                      ? i === index ? "bg-primary-fg" : "bg-primary-fg/40"
                      : i === index ? "bg-primary" : "bg-border-strong"
                  )}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {/* RTL: "previous" is the chevron pointing to the inline-start. */}
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="کمپین قبلی"
              className={cn(
                "grid size-11 place-items-center rounded-md border transition-colors",
                onBurgundy
                  ? "border-primary-fg/30 text-primary-fg hover:bg-white/10"
                  : "border-border bg-surface text-fg-muted hover:text-fg"
              )}
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="کمپین بعدی"
              className={cn(
                "grid size-11 place-items-center rounded-md border transition-colors",
                onBurgundy
                  ? "border-primary-fg/30 text-primary-fg hover:bg-white/10"
                  : "border-border bg-surface text-fg-muted hover:text-fg"
              )}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
