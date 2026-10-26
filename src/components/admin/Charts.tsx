"use client";

import { useId, useState } from "react";
import { formatCompactPrice, formatNumber, toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A small SVG chart set for the admin dashboard.
 *
 * Deliberately single-hue: every chart plots one measure, so identity is carried
 * by axis text and direct labels rather than by colour. That keeps the charts
 * readable in both themes, under colour-blindness, and in print, without a
 * categorical palette to police. Dual y-axes are never used.
 *
 * Each chart ships a table view so the data is reachable by screen readers and
 * not locked inside the drawing.
 */

export interface Point {
  label: string;
  value: number;
}

/**
 * Value formatting is named rather than passed as a function, so a chart can be
 * configured from a Server Component without crossing the serialization
 * boundary with a callback.
 */
export type ValueFormat = "compactPrice" | "price" | "count" | "number";

function formatValue(kind: ValueFormat, value: number): string {
  switch (kind) {
    case "compactPrice": return formatCompactPrice(value);
    case "price": return `${formatNumber(value)} تومان`;
    case "count": return `${toPersianDigits(value)} عدد`;
    default: return formatNumber(value);
  }
}

function DataTable({ points, valueLabel, format }: { points: Point[]; valueLabel: string; format: ValueFormat }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="inline-flex min-h-9 cursor-pointer items-center text-xs text-fg-muted hover:text-fg">
        نمایش داده‌ها به‌صورت جدول
      </summary>
      <div className="mt-2 max-h-56 overflow-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface-2">
            <tr className="text-fg-muted">
              <th scope="col" className="px-3 py-2 text-start font-medium">عنوان</th>
              <th scope="col" className="px-3 py-2 text-start font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {points.map((p) => (
              <tr key={p.label}>
                <td className="px-3 py-1.5 text-fg">{p.label}</td>
                <td className="tnum px-3 py-1.5 text-fg-muted">{formatValue(format, p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Revenue over time. Area + line with a hover crosshair; the y-axis is compact
 * (میلیون تومان) so labels never wrap.
 */
export function TrendChart({
  points, title, format = "compactPrice", height = 200,
}: {
  points: Point[];
  title: string;
  format?: ValueFormat;
  height?: number;
}) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  const W = 640;
  const H = height;
  const padTop = 16, padBottom = 28, padStart = 8, padEnd = 8;

  const max = Math.max(...points.map((p) => p.value)) * 1.12 || 1;
  const innerW = W - padStart - padEnd;
  const innerH = H - padTop - padBottom;

  // RTL: the earliest point sits on the right, so x runs right-to-left.
  const x = (i: number) => W - padEnd - (i / Math.max(1, points.length - 1)) * innerW;
  const y = (v: number) => padTop + innerH - (v / max) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(padTop + innerH).toFixed(1)} L${x(0).toFixed(1)},${(padTop + innerH).toFixed(1)} Z`;

  const ticks = [0, 0.5, 1].map((t) => padTop + innerH - t * innerH);

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${title}. بیشترین مقدار ${formatValue(format, Math.max(...points.map((p) => p.value)))}`}
          onMouseLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-ink)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--chart-ink)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((ty, i) => (
            <line key={i} x1={padStart} x2={W - padEnd} y1={ty} y2={ty} stroke="var(--chart-grid)" strokeWidth="1" />
          ))}

          <path d={area} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" stroke="var(--chart-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {active !== null && (
            <>
              <line
                x1={x(active)} x2={x(active)} y1={padTop} y2={padTop + innerH}
                stroke="var(--chart-ink)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5"
              />
              {/* 2px surface ring keeps the marker legible over the fill. */}
              <circle cx={x(active)} cy={y(points[active].value)} r="6" fill="var(--chart-ink)" stroke="var(--surface)" strokeWidth="2" />
            </>
          )}

          {/* Hit areas are wider than the marks so hover is forgiving. */}
          {points.map((p, i) => (
            <rect
              key={p.label}
              x={x(i) - innerW / points.length / 2}
              y={0}
              width={innerW / points.length}
              height={H}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
            />
          ))}
        </svg>

        {active !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-e2"
            style={{ insetInlineEnd: `${((active / Math.max(1, points.length - 1)) * 100)}%`, transform: "translateX(-50%)" }}
          >
            <p className="font-medium text-fg">{points[active].label}</p>
            <p className="tnum mt-0.5 text-fg-muted">{formatValue(format, points[active].value)}</p>
          </div>
        )}
      </div>

      <div className="mt-1 flex justify-between text-[0.6875rem] text-chart-axis">
        {points.map((p, i) => (
          <span key={p.label} className={cn(points.length > 8 && i % 2 === 1 && "hidden sm:inline")}>
            {p.label}
          </span>
        ))}
      </div>

      <DataTable points={points} valueLabel="مقدار" format={format} />
    </div>
  );
}

/** Vertical bars for counts (orders per day/month). */
export function BarChart({
  points, title, format = "number", height = 180,
}: {
  points: Point[];
  title: string;
  format?: ValueFormat;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.value)) || 1;

  return (
    <div>
      <div
        className="flex items-end gap-1.5 sm:gap-2"
        style={{ height }}
        role="img"
        aria-label={`${title}. بیشترین مقدار ${formatValue(format, max)}`}
        onMouseLeave={() => setActive(null)}
      >
        {points.map((p, i) => (
          <div
            key={p.label}
            className="group relative flex h-full flex-1 flex-col justify-end"
            onMouseEnter={() => setActive(i)}
          >
            {active === i && (
              <div className="pointer-events-none absolute -top-1 start-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-e2">
                <span className="font-medium text-fg">{p.label}</span>
                <span className="tnum ms-2 text-fg-muted">{formatValue(format, p.value)}</span>
              </div>
            )}
            <div
              className={cn(
                "w-full rounded-t-[4px] transition-[background-color,height] duration-[--dur-base]",
                active === i ? "bg-chart-ink" : "bg-chart-ink/70"
              )}
              style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-1.5 text-center text-[0.6875rem] text-chart-axis sm:gap-2">
        {points.map((p) => <span key={p.label} className="flex-1 truncate">{p.label}</span>)}
      </div>

      <DataTable points={points} valueLabel="تعداد" format={format} />
    </div>
  );
}

/**
 * Horizontal bars. Used for "share by category" and "best sellers" — a donut
 * with eight slices would be unreadable, and direct labels make colour
 * redundant here.
 */
export function RankedBarChart({
  points, title, format = "number", showShare,
}: {
  points: Point[];
  title: string;
  format?: ValueFormat;
  showShare?: boolean;
}) {
  const max = Math.max(...points.map((p) => p.value)) || 1;
  const total = points.reduce((n, p) => n + p.value, 0) || 1;

  return (
    <div>
      <ul className="space-y-2.5" role="img" aria-label={title}>
        {points.map((p) => (
          <li key={p.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-fg">{p.label}</span>
              <span className="tnum shrink-0 text-xs text-fg-muted">
                {formatValue(format, p.value)}
                {showShare && (
                  <span className="ms-1.5 text-fg-subtle">
                    ({toPersianDigits(Math.round((p.value / total) * 100))}٪)
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-chart-grid">
              <div
                className="h-full rounded-full bg-chart-ink transition-[width] duration-[--dur-slow]"
                style={{ width: `${Math.max(2, (p.value / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <DataTable points={points} valueLabel="مقدار" format={format} />
    </div>
  );
}

/** Headline number with a trend indicator — not a chart, and shouldn't be one. */
export function StatTile({
  label, value, delta, hint, icon,
}: {
  label: string;
  value: string;
  delta?: { value: number; positiveIsGood?: boolean };
  hint?: string;
  icon?: React.ReactNode;
}) {
  const good = delta ? (delta.positiveIsGood ?? true) === delta.value >= 0 : undefined;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-fg-muted">{label}</p>
        {icon && <span className="text-fg-subtle">{icon}</span>}
      </div>
      <p className="tnum mt-2 text-xl font-bold text-fg sm:text-2xl">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs">
        {delta && (
          // Arrow + sign, so direction never depends on the colour alone.
          <span className={cn("tnum inline-flex items-center gap-0.5 font-medium", good ? "text-success" : "text-danger")}>
            <span aria-hidden>{delta.value >= 0 ? "▲" : "▼"}</span>
            {toPersianDigits(Math.abs(delta.value))}٪
            <span className="sr-only">{delta.value >= 0 ? "افزایش" : "کاهش"} نسبت به دوره قبل</span>
          </span>
        )}
        {hint && <span className="text-fg-subtle">{hint}</span>}
      </div>
    </div>
  );
}

