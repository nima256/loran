import { Ban, CheckCircle2, Clock, CreditCard, PackageCheck, PackageX, RotateCcw, Truck, Wallet } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  isExceptionStatus, ORDER_STATUS_FLOW, ORDER_STATUS_HINTS, ORDER_STATUS_LABELS, ORDER_STATUS_TONE, statusStep,
} from "@/lib/orders";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AnyOrderStatus, OrderTimelineEntry } from "@/types";

const TONE_TO_BADGE: Record<string, BadgeTone> = {
  neutral: "neutral", info: "info", success: "success", warning: "warning", danger: "danger",
};

const STATUS_ICONS: Record<AnyOrderStatus, typeof Clock> = {
  awaiting_payment: Wallet,
  preparing: Clock,
  packaged: PackageCheck,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: Ban,
  returned: RotateCcw,
  refunded: CreditCard,
  payment_failed: PackageX,
  expired: PackageX,
};

export function OrderStatusBadge({ status, size = "md" }: { status: AnyOrderStatus; size?: "sm" | "md" }) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge tone={TONE_TO_BADGE[ORDER_STATUS_TONE[status]]} size={size} icon={<Icon className="size-3.5" aria-hidden />}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Order progress.
 *
 * The five primary statuses are always drawn in order, even when the order has
 * only reached step two — the customer can see what is still ahead. An order in
 * an exception state (cancelled, refunded, …) gets a terminal panel instead of a
 * misleading half-finished progress bar.
 */
export function OrderTimeline({
  status, timeline, className,
}: {
  status: AnyOrderStatus;
  timeline: OrderTimelineEntry[];
  className?: string;
}) {
  if (isExceptionStatus(status)) {
    const Icon = STATUS_ICONS[status];
    const tone = ORDER_STATUS_TONE[status];
    return (
      <div
        className={cn(
          "rounded-lg border p-4 sm:p-5",
          tone === "danger" && "border-danger/30 bg-danger-soft",
          tone === "success" && "border-success/30 bg-success-soft",
          tone === "neutral" && "border-border bg-surface-2"
        )}
      >
        <div className="flex gap-3">
          <Icon
            className={cn(
              "mt-0.5 size-6 shrink-0",
              tone === "danger" && "text-danger",
              tone === "success" && "text-success",
              tone === "neutral" && "text-fg-subtle"
            )}
            aria-hidden
          />
          <div>
            <p className="font-bold text-fg">{ORDER_STATUS_LABELS[status]}</p>
            <p className="mt-1 text-sm leading-7 text-fg-muted">{ORDER_STATUS_HINTS[status]}</p>
            {timeline.length > 0 && (
              <p className="mt-2 text-xs text-fg-subtle">
                آخرین به‌روزرسانی: {formatDateTime(timeline[timeline.length - 1].at)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const current = statusStep(status);
  const reached = new Map(timeline.map((entry) => [entry.status, entry.at]));

  return (
    <div className={className}>
      {/* Horizontal on desktop, vertical on phones — a five-step horizontal bar
          is unreadable at 360px. */}
      <ol className="hidden sm:flex sm:items-start">
        {ORDER_STATUS_FLOW.map((step, i) => {
          const done = i <= current;
          const Icon = STATUS_ICONS[step];
          return (
            <li key={step} className="relative flex flex-1 flex-col items-center text-center last:flex-none last:px-2">
              {i < ORDER_STATUS_FLOW.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-5 h-0.5 w-full",
                    // RTL: the connector runs leftwards from each node.
                    "start-1/2",
                    i < current ? "bg-primary" : "bg-border"
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 grid size-10 place-items-center rounded-full border-2 bg-surface",
                  done ? "border-primary bg-primary text-primary-fg" : "border-border text-fg-subtle"
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <span className={cn("mt-2 max-w-28 text-xs leading-5", done ? "font-semibold text-fg" : "text-fg-subtle")}>
                {ORDER_STATUS_LABELS[step]}
              </span>
              {reached.has(step) && (
                <span className="tnum mt-0.5 text-[0.6875rem] text-fg-subtle">{formatDateTime(reached.get(step)!)}</span>
              )}
              <span className="sr-only">{done ? "(انجام شد)" : "(در انتظار)"}</span>
            </li>
          );
        })}
      </ol>

      <ol className="space-y-0 sm:hidden">
        {ORDER_STATUS_FLOW.map((step, i) => {
          const done = i <= current;
          const Icon = STATUS_ICONS[step];
          const last = i === ORDER_STATUS_FLOW.length - 1;
          return (
            <li key={step} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full border-2",
                    done ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg-subtle"
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                {!last && <span aria-hidden className={cn("w-0.5 flex-1", i < current ? "bg-primary" : "bg-border")} />}
              </div>
              <div className={cn("pb-6", last && "pb-0")}>
                <p className={cn("text-sm", done ? "font-semibold text-fg" : "text-fg-subtle")}>
                  {ORDER_STATUS_LABELS[step]}
                </p>
                {reached.has(step) ? (
                  <p className="tnum mt-0.5 text-xs text-fg-subtle">{formatDateTime(reached.get(step)!)}</p>
                ) : (
                  <p className="mt-0.5 text-xs text-fg-subtle">در انتظار</p>
                )}
                {i === current && (
                  <p className="mt-1 text-xs leading-6 text-fg-muted">{ORDER_STATUS_HINTS[step]}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
