"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeSetting } from "@/store/ThemeProvider";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemeSetting; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "روشن", icon: Sun },
  { value: "dark", label: "تیره", icon: Moon },
  { value: "system", label: "سیستم", icon: Monitor },
];

/**
 * Compact single-button toggle for the header: shows the active mode and cycles
 * light → dark → system. The current mode is announced, not just drawn.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolved, cycleTheme } = useTheme();
  const active = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];
  const Icon = theme === "system" ? (resolved === "dark" ? Moon : Sun) : active.icon;
  const next = OPTIONS[(OPTIONS.findIndex((o) => o.value === theme) + 1) % OPTIONS.length];

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`حالت نمایش: ${active.label}. برای تغییر به حالت ${next.label} کلیک کنید`}
      title={`حالت نمایش: ${active.label}`}
      className={cn(
        "relative grid size-11 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg",
        className
      )}
    >
      <Icon className="size-5" aria-hidden />
      {theme === "system" && (
        <span aria-hidden className="absolute bottom-1.5 size-1 rounded-full bg-fg-subtle" />
      )}
    </button>
  );
}

/** Explicit three-way control for the account settings page. */
export function ThemeSegmented() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="حالت نمایش" className="inline-flex rounded-md border border-border bg-surface-2 p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-[0.5rem] px-4 text-sm font-medium transition-colors",
              active ? "bg-surface text-fg shadow-e1" : "text-fg-muted hover:text-fg"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
