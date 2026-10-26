"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";

/**
 * Delete action for a row of the admin products list.
 *
 * Always confirmed in a modal: the delete is permanent. The server removes the
 * product from every storefront surface; past orders keep their snapshots.
 */
export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const remove = useAction(
    async () => api.delete<{ message: string }>(`/api/v1/admin/products/${id}`),
    {
      onSuccess: (result) => {
        setOpen(false);
        toast({ tone: "success", title: "محصول حذف شد", description: result.message });
        router.refresh();
      },
      onError: (message) => toast({ tone: "error", title: "حذف انجام نشد", description: message }),
    }
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`حذف ${name}`}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-2.5 text-xs text-danger hover:bg-danger-soft"
      >
        <Trash2 className="size-3.5" aria-hidden />
        حذف
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="حذف محصول"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={remove.pending}>
              انصراف
            </Button>
            <Button
              variant="danger"
              onClick={() => void remove.run()}
              loading={remove.pending}
              disabled={remove.pending}
              icon={<Trash2 className="size-4" aria-hidden />}
            >
              حذف برای همیشه
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-7 text-fg">
          «{name}» برای همیشه حذف می‌شود و از فروشگاه، جست‌وجو، دسته‌بندی‌ها، کالکشن‌ها و بخش‌های
          صفحه اصلی برداشته می‌شود.
        </p>
        <p className="mt-2 text-xs leading-6 text-fg-muted">
          سفارش‌های قبلی دست‌نخورده می‌مانند. برای پنهان کردن موقت، محصول را غیرفعال کنید.
        </p>
      </Modal>
    </>
  );
}
