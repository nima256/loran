"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api/client";

/** Soft deletion retains order history and avoids orphaning snapshots/reviews. */
export function ArchiveProductButton({ id, name, compact = false, redirectOnSuccess = true }: { id: string; name: string; compact?: boolean; redirectOnSuccess?: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const archive = async () => {
    setBusy(true); setError("");
    try {
      await api.delete(`/api/v1/admin/products/${id}`);
      setConfirming(false);
      if (redirectOnSuccess) router.replace("/admin/products");
      router.refresh();
    } catch (caught) { setError(errorMessage(caught)); setBusy(false); }
  };
  return <>
    <button type="button" onClick={() => setConfirming(true)}
      className={compact ? "inline-flex h-9 items-center gap-1 rounded-md border border-danger px-2.5 text-xs text-danger hover:bg-danger-soft" : "mt-4 inline-flex items-center gap-2 rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft"}>
      <Trash2 className="size-4" /> {compact ? "حذف" : "حذف محصول از فروشگاه"}
    </button>
    {confirming && <div role="dialog" aria-modal="true" aria-labelledby="delete-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-5">
        <h2 id="delete-title" className="text-lg font-bold text-fg">حذف محصول</h2>
        <p className="text-sm leading-7 text-fg-muted">«{name}» از فروشگاه، جست‌وجو و بخش‌های تبلیغاتی حذف می‌شود. برای حفظ سفارش‌ها و مراجع قبلی، محصول در پایگاه داده بایگانی خواهد شد.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-md border border-border px-4 py-2 text-sm">انصراف</button>
          <button type="button" disabled={busy} onClick={() => void archive()} className="rounded-md bg-danger px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "در حال حذف…" : "بله، حذف شود"}</button>
        </div>
      </div>
    </div>}
  </>;
}
