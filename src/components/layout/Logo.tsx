import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The Loran lockup.
 *
 * The artwork is the supplied logo, untouched — only its ink colour changes
 * between themes (the cream/burgundy pair the brand already uses). The mark sits
 * in a burgundy tile exactly as it does on the business card.
 *
 * `variant="mark"` is the tile alone, for tight spots like the admin rail.
 */
export function Logo({
  variant = "lockup",
  size = "md",
  href = "/",
  className,
  priority,
}: {
  variant?: "lockup" | "mark" | "wordmark";
  size?: "sm" | "md" | "lg";
  href?: string | null;
  className?: string;
  priority?: boolean;
}) {
  const dims = {
    sm: { tile: "size-8 rounded-[0.5rem] p-1", mark: 24, word: "h-3.5 w-[4.2rem]" },
    md: { tile: "size-10 rounded-[0.65rem] p-1.5", mark: 30, word: "h-4 w-[5rem]" },
    lg: { tile: "size-14 rounded-[0.9rem] p-2", mark: 44, word: "h-6 w-[7.5rem]" },
  }[size];

  const tile = (
    <span className={cn("grid shrink-0 place-items-center bg-primary", dims.tile)}>
      <Image
        src="/brand/loran-mark-cream.png"
        alt=""
        width={dims.mark}
        height={dims.mark}
        priority={priority}
        className="h-full w-full object-contain"
      />
    </span>
  );

  const wordmark = (
    <span className={cn("relative block shrink-0", dims.word)}>
      {/* Burgundy in light, cream in dark — same artwork, brand-correct ink. */}
      <Image src="/brand/loran-wordmark-burgundy.png" alt="" fill sizes="120px" className="object-contain object-right dark:hidden" priority={priority} />
      <Image src="/brand/loran-wordmark-cream.png" alt="" fill sizes="120px" className="hidden object-contain object-right dark:block" priority={priority} />
    </span>
  );

  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {variant !== "wordmark" && tile}
      {variant !== "mark" && wordmark}
      <span className="sr-only">لوران، فروشگاه اینترنتی کفش</span>
    </span>
  );

  if (href === null) return content;
  return (
    <Link href={href} aria-label="لوران — صفحه اصلی" className="inline-flex rounded-md">
      {content}
    </Link>
  );
}
