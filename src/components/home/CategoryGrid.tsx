import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toPersianDigits } from "@/lib/format";
import type { Category } from "@/types";

/**
 * Category tiles — the eight-tile block from the wireframe.
 *
 * Two columns on phones so the tiles stay large enough to tap comfortably, four
 * on desktop. Each tile is a single link, never a hover-only affordance.
 */
export function CategoryGrid({
  categories,
  counts,
}: {
  categories: (Category & { image?: string })[];
  counts: Map<string, number>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/category/${category.slug}`}
          className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface
                     transition-[border-color,box-shadow,transform] duration-[--dur-base] ease-[--ease-out]
                     hover:border-border-strong hover:shadow-e2 motion-safe:hover:-translate-y-0.5"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-surface-inset">
            {category.image && (
              <Image
                src={category.image}
                alt=""
                fill
                sizes="(min-width: 1024px) 22vw, 47vw"
                className="object-cover transition-transform duration-[--dur-slow] ease-[--ease-out] motion-safe:group-hover:scale-105"
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-2 p-3 sm:p-4">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-fg sm:text-base">{category.name}</h3>
              <p className="tnum mt-0.5 text-xs text-fg-subtle">
                {toPersianDigits(counts.get(category.id) ?? 0)} محصول
              </p>
            </div>
            <ArrowLeft
              className="size-4 shrink-0 text-fg-subtle transition-transform duration-[--dur-base] motion-safe:group-hover:-translate-x-1"
              aria-hidden
            />
          </div>
        </Link>
      ))}
    </div>
  );
}
