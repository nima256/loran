"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Product gallery.
 *
 * The image set is driven by the selected colourway, so changing colour changes
 * the photos. All frames share a 1:1 ratio, which is what stops the page from
 * jumping when the user switches colour or image.
 */
export function ProductGallery({
  images, alt, badge,
}: {
  images: string[];
  alt: string;
  badge?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  // A new colourway restarts the gallery at its first frame.
  useEffect(() => setIndex(0), [images]);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(false);
      if (e.key === "ArrowLeft") setIndex((i) => (i + 1) % images.length);
      if (e.key === "ArrowRight") setIndex((i) => (i - 1 + images.length) % images.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoomed, images.length]);

  const go = (next: number) => setIndex((next + images.length) % images.length);

  return (
    <>
      <div className="flex flex-col-reverse gap-3 md:flex-row">
        {/* Thumbnails: a row under the image on phones, a rail beside it on desktop */}
        <div
          ref={stripRef}
          className="no-scrollbar flex gap-2 overflow-x-auto md:w-20 md:shrink-0 md:flex-col md:overflow-visible"
          role="tablist"
          aria-label="تصویرهای محصول"
        >
          {images.map((src, i) => (
            <button
              key={src}
              role="tab"
              type="button"
              aria-selected={i === index}
              aria-label={`تصویر ${toPersianDigits(i + 1)}`}
              onClick={() => setIndex(i)}
              className={cn(
                "relative aspect-square w-16 shrink-0 overflow-hidden rounded-md border-2 bg-surface-inset transition-colors md:w-full",
                i === index ? "border-primary" : "border-border hover:border-border-strong"
              )}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-inset">
            <Image
              key={images[index]}
              src={images[index]}
              alt={`${alt} — تصویر ${toPersianDigits(index + 1)} از ${toPersianDigits(images.length)}`}
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="animate-fade-in object-cover"
            />
            {badge && <div className="absolute start-3 top-3 flex flex-col gap-1.5">{badge}</div>}

            <button
              type="button"
              onClick={() => setZoomed(true)}
              aria-label="بزرگ‌نمایی تصویر"
              className="absolute end-3 top-3 grid size-11 place-items-center rounded-md bg-surface/85 text-fg-muted backdrop-blur transition-colors hover:text-fg"
            >
              <Expand className="size-5" aria-hidden />
            </button>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  aria-label="تصویر قبلی"
                  className="absolute start-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/85 text-fg-muted backdrop-blur transition-colors hover:text-fg"
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => go(index + 1)}
                  aria-label="تصویر بعدی"
                  className="absolute end-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/85 text-fg-muted backdrop-blur transition-colors hover:text-fg"
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="نمایش بزرگ تصویر محصول"
          className="fixed inset-0 grid place-items-center bg-[#1b1310]/90 p-4"
          style={{ zIndex: "var(--z-modal)" }}
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="بستن"
            className="absolute end-4 top-4 grid size-12 place-items-center rounded-md bg-white/10 text-white hover:bg-white/20"
          >
            <X className="size-6" aria-hidden />
          </button>
          <div className="relative aspect-square w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Image src={images[index]} alt={alt} fill sizes="90vw" className="rounded-lg object-contain" />
          </div>
          {images.length > 1 && (
            <div className="absolute bottom-6 flex gap-2" onClick={(e) => e.stopPropagation()}>
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`تصویر ${toPersianDigits(i + 1)}`}
                  className={cn("h-2 rounded-full transition-all", i === index ? "w-8 bg-white" : "w-2 bg-white/40")}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
