"use client";

import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Inline alert. Colour is never the only signal — every tone carries an icon. */
export type AlertTone = "info" | "success" | "warning" | "danger" | "brand";

const ALERT_TONES: Record<AlertTone, { wrap: string; icon: React.ReactNode }> = {
  info: { wrap: "bg-info-soft border-info/25 text-fg", icon: <Info className="size-5 text-info" aria-hidden /> },
  success: { wrap: "bg-success-soft border-success/25 text-fg", icon: <CheckCircle2 className="size-5 text-success" aria-hidden /> },
  warning: { wrap: "bg-warning-soft border-warning/30 text-fg", icon: <TriangleAlert className="size-5 text-warning" aria-hidden /> },
  danger: { wrap: "bg-danger-soft border-danger/30 text-fg", icon: <AlertCircle className="size-5 text-danger" aria-hidden /> },
  brand: { wrap: "bg-primary-soft border-primary-border text-fg", icon: <Info className="size-5 text-primary-soft-fg" aria-hidden /> },
};

export function Alert({
  tone = "info", title, children, action, className, role,
}: {
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const { wrap, icon } = ALERT_TONES[tone];
  return (
    <div role={role} className={cn("flex gap-3 rounded-lg border p-4", wrap, className)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-fg">{title}</p>}
        {children && <div className={cn("text-sm leading-7 text-fg-muted", title && "mt-1")}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

/** Empty state. Always offers a next action — never a dead end. */
export function EmptyState({
  icon, title, description, action, secondaryAction, className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center", className)}>
      {icon && (
        <span className="mb-4 grid size-16 place-items-center rounded-full bg-surface-3 text-primary dark:text-[color:var(--primary-soft-fg)]">
          {icon}
        </span>
      )}
      <h3 className="text-lg font-bold text-fg">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-7 text-fg-muted">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/** Skeleton block. Sized by the caller so it reserves the real layout space. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-3 h-5 w-1/2" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  );
}

/** Inline busy indicator for buttons and small regions. */
export function Spinner({ className, label = "در حال بارگذاری" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("inline-block", className)}>
      <svg viewBox="0 0 24 24" className="size-full animate-spin" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
