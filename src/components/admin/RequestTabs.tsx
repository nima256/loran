"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/** GET-based tabs, so a new requests list is always loaded on the server. */
export function RequestTabs({
  counts,
}: {
  counts: { consultations: number; contact: number; newsletter: number };
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("tab") ?? "consultations";
  const tabs = [
    { value: "consultations", label: "مشاوره سایز", count: counts.consultations },
    { value: "contact", label: "تماس با ما", count: counts.contact },
    { value: "newsletter", label: "خبرنامه", count: counts.newsletter },
  ];

  const hrefFor = (tab: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", tab);
    next.delete("status"); // Different lists must not share a status filter.
    next.delete("page");
    return `${pathname}?${next.toString()}`;
  };

  return (
    <nav aria-label="نوع درخواست" className="mb-4 border-b border-border">
      <div className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = current === tab.value;
          return (
            <a
              key={tab.value}
              href={hrefFor(tab.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                active ? "border-primary text-primary dark:text-[color:var(--primary-soft-fg)]" : "border-transparent text-fg-muted hover:text-fg"
              )}
            >
              {tab.label}
              <span className="tnum ms-1.5 text-xs text-fg-subtle">{toPersianDigits(tab.count)}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
