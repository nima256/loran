import Image from "next/image";
import { isLocalUpload } from "@/lib/media";
import Link from "next/link";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { toPersianDigits } from "@/lib/format";
import type { Category } from "@/types";

/**
 * Category tiles — the eight-tile block from the wireframe.
 *
 * Two columns on phones so the tiles stay large enough to tap comfortably, four
 * on desktop. Each tile is a single link, never a hover-only affordance. A
 * category with no image yet gets a quiet placeholder rather than a hole.
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
        <CardTile
          key={category.id}
          href={`/category/${category.slug}`}
          image={category.image}
          title={category.name}
          subtitle={category.description}
          meta={`${toPersianDigits(counts.get(category.id) ?? 0)} محصول`}
        />
      ))}
    </div>
  );
}

/** One linked image card — shared by the category and collection grids. */
export function CardTile({
  href, image, title, subtitle, meta,
}: {
  href: string;
  image?: string;
  title: string;
  subtitle?: string;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface
                 transition-[border-color,box-shadow,transform] duration-[--dur-base] ease-[--ease-out]
                 hover:border-border-strong hover:shadow-e2 motion-safe:hover:-translate-y-0.5"
    >
      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-surface-inset">
        {image ? (
          <Image
            src={image} unoptimized={isLocalUpload(image)}
            alt=""
            fill
            sizes="(min-width: 1024px) 22vw, 47vw"
            className="object-cover transition-transform duration-[--dur-slow] ease-[--ease-out] motion-safe:group-hover:scale-105"
          />
        ) : (
          <ImageIcon className="size-8 text-fg-subtle/60" aria-hidden />
        )}
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 p-3 sm:p-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-fg sm:text-base">{title}</h3>
          {subtitle && <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-fg-muted">{subtitle}</p>}
          {meta && <p className="tnum mt-0.5 text-xs text-fg-subtle">{meta}</p>}
        </div>
        <ArrowLeft
          className="size-4 shrink-0 text-fg-subtle transition-transform duration-[--dur-base] motion-safe:group-hover:-translate-x-1"
          aria-hidden
        />
      </div>
    </Link>
  );
}
