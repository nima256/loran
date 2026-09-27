"use client";

import { Star } from "lucide-react";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Read-only star display. The numeric value is always exposed as text too, so
 * the rating is never communicated by the star shapes alone.
 */
export function Stars({ value, size = "md", className }: { value: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "size-3.5", md: "size-4", lg: "size-5" };
  const percent = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden>
      <span className="flex gap-0.5 text-border-strong">
        {[0, 1, 2, 3, 4].map((i) => <Star key={i} className={cn(sizes[size], "fill-current")} />)}
      </span>
      {/* RTL: the filled overlay is clipped from the inline-start (right) edge. */}
      <span className="absolute inset-y-0 start-0 overflow-hidden" style={{ width: `${percent}%` }}>
        <span className="flex gap-0.5 text-[#D9A441]">
          {[0, 1, 2, 3, 4].map((i) => <Star key={i} className={cn(sizes[size], "fill-current")} />)}
        </span>
      </span>
    </span>
  );
}

export function RatingSummary({
  value, count, size = "md", className,
}: { value: number; count?: number; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Stars value={value} size={size} />
      <span className="tnum text-sm font-medium text-fg">{toPersianDigits(value.toFixed(1))}</span>
      {count != null && (
        <span className="tnum text-xs text-fg-subtle">({toPersianDigits(count)} نظر)</span>
      )}
      <span className="sr-only">امتیاز {toPersianDigits(value.toFixed(1))} از ۵</span>
    </span>
  );
}

/** Interactive star picker for the review form. Fully keyboard operable. */
export function StarPicker({
  value, onChange, error, id,
}: { value: number; onChange: (value: number) => void; error?: boolean; id?: string }) {
  const labels = ["خیلی بد", "بد", "متوسط", "خوب", "عالی"];
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="امتیاز شما"
      aria-invalid={error || undefined}
      className="flex items-center gap-1"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${toPersianDigits(star)} ستاره — ${labels[star - 1]}`}
          onClick={() => onChange(star)}
          className="grid size-11 place-items-center rounded-md transition-transform duration-[--dur-fast] hover:scale-110 active:scale-95"
        >
          <Star
            className={cn("size-7", star <= value ? "fill-[#D9A441] text-[#D9A441]" : "fill-transparent text-border-strong")}
            strokeWidth={1.5}
          />
        </button>
      ))}
      <span className="ms-2 text-sm text-fg-muted">{value > 0 ? labels[value - 1] : "انتخاب کنید"}</span>
    </div>
  );
}
