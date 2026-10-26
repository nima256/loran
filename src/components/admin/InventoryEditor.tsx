"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Inline stock editing.
 *
 * The write goes straight to the variant and is audited, so the warehouse
 * number and the storefront's availability can never drift apart. The field
 * only saves on blur or Enter — saving on every keystroke would write a stock
 * of 4 on the way to typing 42.
 */
export function StockCell({
  variantId,
  productId,
  stock,
}: {
  variantId: string;
  productId: string;
  stock: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(String(stock));
  const [saved, setSaved] = useState(false);

  const save = useAction(
    async (next: number) =>
      api.patch(`/api/v1/admin/products/${productId}/variants/${variantId}`, { stock: next }),
    {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      },
      onError: (message) => {
        // Put the old number back — the save did not happen.
        setValue(String(stock));
        toast({ tone: "error", title: "ذخیره موجودی انجام نشد", description: message });
      },
    }
  );

  const commit = () => {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0 || next === stock) {
      setValue(String(stock));
      return;
    }
    void save.run(next);
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setValue(String(stock));
        }}
        disabled={save.pending}
        aria-label="موجودی"
        aria-busy={save.pending}
        className={cn(
          "tnum h-10 w-16 rounded-md border bg-surface text-center text-sm",
          "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25",
          "disabled:opacity-60",
          stock === 0
            ? "border-danger/40 text-danger"
            : stock <= 3
              ? "border-warning/50 text-fg"
              : "border-border text-fg"
        )}
      />
      {saved && <Check className="size-4 text-success" aria-label="ذخیره شد" />}
    </span>
  );
}

export function StockStatus({ stock }: { stock: number }) {
  if (stock === 0) return <Badge tone="danger" size="sm">ناموجود</Badge>;
  if (stock <= 3) return <Badge tone="warning" size="sm">رو به اتمام</Badge>;
  return <span className="tnum text-xs text-fg-subtle">{toPersianDigits(stock)} عدد</span>;
}

export function ProductLink({ slug, name }: { slug: string; name: string }) {
  return (
    <Link
      href={`/admin/products/${slug}`}
      className="line-clamp-1 text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]"
    >
      {name}
    </Link>
  );
}
