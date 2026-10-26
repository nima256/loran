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
 *
 * Layout: the mark sits to the *left* of the «LORAN» wordmark. The site is RTL,
 * so the wordmark comes first in the DOM (rightmost) and the mark second.
 */

/** The logo mark. Replace this file to change the logo everywhere. */
const MARK_SRC = "/brand/loran-mark-tan.png";
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
    <span className={cn("grid shrink-0 place-items-center", dims.tile)}>
      <Image
        src={MARK_SRC}
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
      {/* Anchored to the side facing the mark, so the gap stays even at every size. */}
      <Image src="/brand/loran-wordmark-burgundy.png" alt="" fill sizes="120px" className="object-contain object-left dark:hidden" priority={priority} />
      <Image src="/brand/loran-wordmark-cream.png" alt="" fill sizes="120px" className="hidden object-contain object-left dark:block" priority={priority} />
    </span>
  );

  const content = (
    <span className={cn("inline-flex items-center gap-2 sm:gap-2.5", className)}>
      {variant !== "mark" && wordmark}
      {variant !== "wordmark" && tile}
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
