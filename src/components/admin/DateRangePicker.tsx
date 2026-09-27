"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Report date range.
 *
 * The range lives in the query string, so a range is shareable, survives a
 * refresh and works with the back button. Choosing one is a real navigation —
 * the server re-queries — which is why the control shows a pending state
 * instead of appearing to do nothing.
 */

const PRESETS = [
  { days: 7, label: "۷ روز" },
  { days: 30, label: "۳۰ روز" },
  { days: 90, label: "۳ ماه" },
  { days: 365, label: "یک سال" },
];

export function DateRangePicker({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const active = Number(params.get("days") ?? 30);

  const select = (days: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("days", String(days));
    // An explicit from/to would contradict a preset, so it is cleared.
    next.delete("from");
    next.delete("to");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  return (
    <div
      className={cn("flex items-center gap-1 rounded-md border border-border bg-surface p-1", className)}
      role="group"
      aria-label="بازه زمانی گزارش"
      aria-busy={pending}
    >
      <Calendar className="mx-1.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
      {PRESETS.map((preset) => {
        const isActive = active === preset.days;
        return (
          <button
            key={preset.days}
            type="button"
            onClick={() => select(preset.days)}
            disabled={pending}
            aria-pressed={isActive}
            className={cn(
              "min-h-9 rounded px-2.5 text-xs font-medium transition-colors disabled:opacity-60",
              isActive
                ? "bg-primary text-primary-fg"
                : "text-fg-muted hover:bg-surface-2 hover:text-fg"
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
