"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The single button primitive.
 *
 * `primary` is the burgundy brand action and is deliberately rationed — one per
 * screen region. Everything else is quieter so the brand colour keeps meaning.
 */
export type ButtonVariant = "primary" | "secondary" | "subtle" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-active shadow-e1 " +
    "disabled:bg-primary/40 disabled:shadow-none",
  secondary:
    "bg-surface text-fg border border-border-strong hover:bg-surface-2 active:bg-surface-3 " +
    "disabled:text-fg-subtle disabled:bg-surface",
  subtle:
    "bg-surface-3 text-fg hover:bg-border active:bg-border-strong " +
    "dark:bg-surface-2 dark:hover:bg-surface-3",
  ghost: "bg-transparent text-fg hover:bg-surface-2 active:bg-surface-3",
  danger: "bg-danger text-white hover:brightness-110 active:brightness-95 dark:text-[#2a1513]",
  link: "bg-transparent text-primary hover:underline underline-offset-4 px-0 h-auto dark:text-[color:var(--primary-soft-fg)]",
};

const SIZES: Record<ButtonSize, string> = {
  // 44px / 48px minimum heights keep every button a valid touch target.
  sm: "h-11 px-4 text-sm gap-2 rounded-md",
  md: "h-12 px-5 text-sm gap-2 rounded-md",
  lg: "h-14 px-7 text-base gap-2.5 rounded-md",
};

const base =
  "inline-flex items-center justify-center font-medium select-none " +
  "transition-[background-color,color,border-color,box-shadow,opacity] duration-[--dur-fast] " +
  "disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap";

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  /** Rendered before the label in reading order (i.e. on the right in RTL). */
  icon?: React.ReactNode;
  iconEnd?: React.ReactNode;
}

export type ButtonProps = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, loading, icon, iconEnd, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      // Keep the button focusable while busy so screen readers can stay on it.
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(base, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className)}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconEnd}
    </button>
  );
});

export type ButtonLinkProps = CommonProps &
  Omit<React.ComponentProps<typeof Link>, "className"> & { className?: string };

/** Same visual system, but a real anchor — used for navigation, never actions. */
export function ButtonLink({
  variant = "primary", size = "md", fullWidth, icon, iconEnd, className, children, ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(base, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className)} {...props}>
      {icon}
      {children}
      {iconEnd}
    </Link>
  );
}

/**
 * Icon-only control. `label` is required — it becomes the accessible name and
 * the tooltip, so an icon button can never ship unlabelled.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  { label: string; size?: "sm" | "md" | "lg"; variant?: ButtonVariant } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function IconButton({ label, size = "md", variant = "ghost", className, children, ...props }, ref) {
  const sizes = { sm: "size-9", md: "size-11", lg: "size-12" };
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        base, VARIANTS[variant], sizes[size],
        "rounded-md p-0 shrink-0",
        variant === "primary" ? "" : "text-fg-muted hover:text-fg",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
