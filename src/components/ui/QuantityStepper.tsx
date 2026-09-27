"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Quantity control. Capped at the variant's stock so the UI can never ask for
 * more than exists; at quantity 1 the decrement turns into a remove action so
 * the cart never traps a line at one.
 */
export function QuantityStepper({
  value, max, min = 1, onChange, onRemove, size = "md", disabled, label = "تعداد",
}: {
  value: number;
  max: number;
  min?: number;
  onChange: (value: number) => void;
  onRemove?: () => void;
  size?: "sm" | "md";
  disabled?: boolean;
  label?: string;
}) {
  const atMin = value <= min;
  const atMax = value >= max;
  const sizes = size === "sm" ? "h-10" : "h-12";
  const btn = cn(
    "grid aspect-square h-full place-items-center rounded-md text-fg-muted transition-colors",
    "hover:bg-surface-2 hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent"
  );

  return (
    <div className={cn("inline-flex items-center rounded-md border border-border bg-surface", sizes)}>
      <button
        type="button"
        className={btn}
        disabled={disabled || (atMin && !onRemove)}
        aria-label={atMin && onRemove ? "حذف از سبد خرید" : `کاهش ${label}`}
        onClick={() => (atMin && onRemove ? onRemove() : onChange(value - 1))}
      >
        {atMin && onRemove ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
      </button>
      <span
        className="tnum grid min-w-10 place-items-center text-sm font-semibold text-fg"
        aria-live="polite"
        aria-label={`${label}: ${toPersianDigits(value)}`}
      >
        {toPersianDigits(value)}
      </span>
      <button
        type="button"
        className={btn}
        disabled={disabled || atMax}
        aria-label={atMax ? `بیشتر از ${toPersianDigits(max)} عدد موجود نیست` : `افزایش ${label}`}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
