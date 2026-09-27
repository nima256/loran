"use client";

import { forwardRef, useId } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Checkbox with a label that is part of the hit area (44px tall row). */
export const Checkbox = forwardRef<
  HTMLInputElement,
  { label: React.ReactNode; hint?: string; indeterminate?: boolean; count?: number } & React.InputHTMLAttributes<HTMLInputElement>
>(function Checkbox({ label, hint, indeterminate, count, className, id, ...props }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cn("flex items-start gap-3 min-h-11 py-1", className)}>
      <span className="relative flex items-center justify-center mt-[0.6rem] shrink-0">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="peer size-5 appearance-none rounded-[0.3rem] border-[1.5px] border-border-strong bg-surface
                     checked:bg-primary checked:border-primary
                     indeterminate:bg-primary indeterminate:border-primary
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-[--dur-fast] cursor-pointer"
          {...props}
        />
        <span className="pointer-events-none absolute text-primary-fg opacity-0 peer-checked:opacity-100">
          {indeterminate ? <Minus className="size-3.5" strokeWidth={3} /> : <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </span>
      <label htmlFor={inputId} className="flex-1 cursor-pointer py-1.5 text-sm leading-6 select-none">
        <span className="flex items-center justify-between gap-2">
          <span className="text-fg">{label}</span>
          {count != null && <span className="tnum text-xs text-fg-subtle">{count.toLocaleString("fa-IR")}</span>}
        </span>
        {hint && <span className="block text-xs text-fg-muted">{hint}</span>}
      </label>
    </div>
  );
});

/** Radio rendered as a selectable card — used for addresses, shipping, payment. */
export function RadioCard({
  checked, disabled, badge, title, description, footer, name, value, onChange, id,
}: {
  checked: boolean;
  disabled?: boolean;
  badge?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  name: string;
  value: string;
  onChange?: (value: string) => void;
  id?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "relative flex gap-3 rounded-lg border p-4 transition-[border-color,background-color] duration-[--dur-fast]",
        disabled
          ? "border-border bg-surface-2 opacity-70 cursor-not-allowed"
          : "cursor-pointer bg-surface hover:border-border-strong",
        checked && !disabled ? "border-primary bg-primary-soft/40 ring-1 ring-primary/30" : "border-border"
      )}
    >
      <input
        id={inputId}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.(value)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-1 size-5 shrink-0 rounded-full border-[1.5px] grid place-items-center",
          checked && !disabled ? "border-primary" : "border-border-strong"
        )}
      >
        {checked && !disabled && <span className="size-2.5 rounded-full bg-primary" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">{title}</span>
          {badge}
        </span>
        {description && <span className="mt-1 block text-sm leading-6 text-fg-muted">{description}</span>}
        {footer && <span className="mt-2 block">{footer}</span>}
      </span>
    </label>
  );
}

/** Theme/settings toggle. */
export function Switch({
  checked, onChange, label, description, disabled, id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const descId = `${switchId}-desc`;
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <label htmlFor={switchId} className="block text-sm font-medium text-fg cursor-pointer">{label}</label>
        {description && <p id={descId} className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-[--dur-base]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          checked ? "bg-primary" : "bg-border-strong"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1 size-5 rounded-full bg-white shadow-e1 transition-[inset-inline-start] duration-[--dur-base] ease-[--ease-out]",
            checked ? "start-6" : "start-1"
          )}
        />
      </button>
    </div>
  );
}
