import { cn } from "@/lib/utils";

/**
 * Status and label chips.
 *
 * Tones map onto the semantic colour tokens, so a «موجود» badge is the same
 * green in the storefront, the account area and the admin panel.
 */
export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "sale";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg-muted border-border",
  brand: "bg-primary-soft text-primary-soft-fg border-primary-border",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  info: "bg-info-soft text-info border-transparent",
  sale: "bg-sale text-sale-fg border-transparent",
};

export function Badge({
  tone = "neutral", size = "md", icon, className, children,
}: {
  tone?: BadgeTone;
  size?: "sm" | "md";
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-xs border font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[0.6875rem]" : "px-2 py-1 text-xs",
        TONES[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Discount percentage pill used on product cards and the product page. */
export function DiscountBadge({ percent, size = "md" }: { percent: number; size?: "sm" | "md" }) {
  if (percent <= 0) return null;
  return (
    <span
      className={cn(
        "tnum inline-flex items-center justify-center rounded-xs bg-sale font-bold text-sale-fg",
        size === "sm" ? "px-1.5 py-0.5 text-[0.6875rem]" : "px-2 py-1 text-xs"
      )}
    >
      {percent.toLocaleString("fa-IR")}٪
    </span>
  );
}

/**
 * Removable filter tag. The label stays readable: the collection wraps rather
 * than shrinking, and the ✕ is a real button with its own accessible name.
 */
export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface ps-3 pe-1 py-1 text-sm text-fg">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`حذف فیلتر ${label}`}
        className="grid size-7 place-items-center rounded-full text-fg-subtle hover:bg-surface-2 hover:text-danger transition-colors"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}

/** Selectable pill — sort options, quick filters, tabs-as-chips. */
export function Chip({
  selected, disabled, onClick, children, className,
}: {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium",
        "transition-[background-color,border-color,color] duration-[--dur-fast] disabled:opacity-50",
        selected
          ? "border-primary bg-primary text-primary-fg"
          : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
        className
      )}
    >
      {children}
    </button>
  );
}
