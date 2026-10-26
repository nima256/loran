"use client";

import { forwardRef, useId } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Text field with a permanent visible label (never placeholder-only), optional
 * helper text, and an error that is wired to the input via aria-describedby.
 */
export interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Persistent unit/adornment, e.g. «تومان». */
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
  className?: string;
}

const controlBase =
  "w-full bg-surface text-fg rounded-md border border-border-strong " +
  "px-4 text-base placeholder:text-fg-subtle " +
  "transition-[border-color,box-shadow] duration-[--dur-fast] " +
  "hover:border-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 " +
  "disabled:bg-surface-2 disabled:text-fg-subtle disabled:border-border disabled:cursor-not-allowed " +
  "read-only:bg-surface-2 read-only:text-fg-muted";

export function FieldLabel({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-fg mb-1.5">
      {children}
      {required && <span className="text-primary mr-1" aria-hidden>*</span>}
      {required && <span className="sr-only">(الزامی)</span>}
    </label>
  );
}

export function FieldMessages({ error, hint, errorId, hintId }: { error?: string; hint?: string; errorId: string; hintId: string }) {
  return (
    <>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle className="size-4 mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-sm text-fg-muted">{hint}</p>
      ) : null}
    </>
  );
}

export type InputProps = FieldShellProps & React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, suffix, prefix, className, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className={className}>
      <FieldLabel htmlFor={inputId} required={required}>{label}</FieldLabel>
      <div className="relative">
        {prefix && (
          <span className="absolute inset-y-0 start-0 flex items-center ps-4 text-fg-subtle pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            controlBase,
            "h-12",
            prefix && "ps-12",
            suffix && "pe-20",
            error && "border-danger focus:border-danger focus:ring-danger/25"
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute inset-y-0 end-0 flex items-center pe-4 text-sm text-fg-muted pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      <FieldMessages error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  );
});

export type TextareaProps = FieldShellProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, id, rows = 4, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  return (
    <div className={className}>
      <FieldLabel htmlFor={inputId} required={required}>{label}</FieldLabel>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        required={required}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(controlBase, "py-3 leading-7 resize-y min-h-28", error && "border-danger focus:border-danger focus:ring-danger/25")}
        {...props}
      />
      <FieldMessages error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  );
});

export type SelectProps = FieldShellProps &
  React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string; disabled?: boolean }[]; placeholder?: string };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, className, id, options, placeholder, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  return (
    <div className={className}>
      <FieldLabel htmlFor={inputId} required={required}>{label}</FieldLabel>
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            controlBase, "h-12 appearance-none pe-11 cursor-pointer",
            error && "border-danger focus:border-danger focus:ring-danger/25"
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute inset-y-0 end-4 my-auto size-4 text-fg-muted"
          viewBox="0 0 16 16" fill="none" aria-hidden
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <FieldMessages error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  );
});
