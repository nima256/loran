"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { days: 7, label: "۷ روز" },
  { days: 30, label: "۳۰ روز" },
  { days: 90, label: "۳ ماه" },
  { days: 365, label: "یک سال" },
];

/** Server-side date filters with no stale router transition or disabled state. */
export function DateRangePicker({ className }: { className?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = Number(params.get("days") ?? 30);

  const hrefFor = (days: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("days", String(days));
    next.delete("from");
    next.delete("to");
    const search = next.toString();
    return search ? `${pathname}?${search}` : pathname;
  };

  return (
    <nav
      className={cn("flex items-center gap-1 rounded-md border border-border bg-surface p-1", className)}
      aria-label="بازه زمانی گزارش"
    >
      <Calendar className="mx-1.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
      {PRESETS.map((preset) => {
        const isActive = active === preset.days;
        return (
          <a
            key={preset.days}
            href={hrefFor(preset.days)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded px-2.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-fg"
                : "text-fg-muted hover:bg-surface-2 hover:text-fg"
            )}
          >
            {preset.label}
          </a>
        );
      })}
    </nav>
  );
}
