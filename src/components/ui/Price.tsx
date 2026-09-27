import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DiscountBadge } from "./Badge";

/**
 * The canonical price block: current price, struck-through original, discount
 * badge. Tomans is written once as a smaller suffix rather than repeated on
 * both numbers, which is how Iranian shops present it.
 */
export function Price({
  value, compareAt, size = "md", showBadge = true, align = "start", className,
}: {
  value: number;
  compareAt?: number;
  size?: "sm" | "md" | "lg" | "xl";
  showBadge?: boolean;
  align?: "start" | "end";
  className?: string;
}) {
  const hasDiscount = !!compareAt && compareAt > value;
  const percent = hasDiscount ? Math.round(((compareAt - value) / compareAt) * 100) : 0;

  const sizes = {
    sm: { main: "text-sm", unit: "text-[0.6875rem]", old: "text-[0.8125rem]" },
    md: { main: "text-base", unit: "text-xs", old: "text-sm" },
    lg: { main: "text-xl", unit: "text-sm", old: "text-sm" },
    xl: { main: "text-2xl sm:text-3xl", unit: "text-base", old: "text-base" },
  }[size];

  return (
    <div className={cn("flex flex-col gap-1", align === "end" && "items-end", className)}>
      {hasDiscount && (
        <div className="flex items-center gap-2">
          {showBadge && <DiscountBadge percent={percent} size={size === "sm" ? "sm" : "md"} />}
          <span className={cn("tnum text-fg-subtle line-through decoration-1 decoration-fg-subtle/60", sizes.old)}>
            {formatAmount(compareAt)}
          </span>
        </div>
      )}
      <div className="flex items-baseline gap-1">
        <span className={cn("tnum font-bold text-fg", sizes.main)}>{formatAmount(value)}</span>
        <span className={cn("font-medium text-fg-muted", sizes.unit)}>تومان</span>
      </div>
    </div>
  );
}

/** Single-line price for tables, cart rows and the invoice. */
export function PriceInline({ value, className, muted }: { value: number; className?: string; muted?: boolean }) {
  return (
    <span className={cn("tnum whitespace-nowrap", muted ? "text-fg-muted" : "font-medium text-fg", className)}>
      {formatAmount(value)} <span className="text-xs font-normal text-fg-muted">تومان</span>
    </span>
  );
}
