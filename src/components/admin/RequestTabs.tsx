"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Tabs } from "@/components/ui/Navigation";

/**
 * Tab switcher for the requests screen.
 *
 * The tab lives in the query string so a refresh, the back button and a shared
 * link all land on the same list.
 */
export function RequestTabs({
  counts,
}: {
  counts: { consultations: number; contact: number; newsletter: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const current = params.get("tab") ?? "consultations";

  const select = (tab: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", tab);
    // Filters belong to the list that was showing; a new tab starts clean.
    next.delete("status");
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  };

  return (
    <Tabs
      className="mb-4"
      value={current}
      onChange={select}
      tabs={[
        { value: "consultations", label: "مشاوره سایز", count: counts.consultations },
        { value: "contact", label: "تماس با ما", count: counts.contact },
        { value: "newsletter", label: "خبرنامه", count: counts.newsletter },
      ]}
    />
  );
}
